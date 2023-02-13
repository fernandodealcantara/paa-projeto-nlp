import re
import json
import spacy
from spacy.tokens import DocBin
from pathlib import Path
import warnings
from tqdm import tqdm

def carregar_json(caminho_arquivo: str) -> dict:
    with open(caminho_arquivo, "r") as arquivo:
        return json.load(arquivo)
    
def salvar_json(caminho_arquivo: str, dados: dict):
    with open(caminho_arquivo, "w") as arquivo:
        json.dump(dados, arquivo, ensure_ascii=False, indent=4)


def remover_html_tags(texto: str) -> str:
    return re.sub(r"<.*?>", "", texto)  # remove qualquer tag HTML


def remover_caracteres_especiais(texto: str) -> str:
    # &nbsp; é um espaço em branco (unico caractere de interesse, pode adicionar mais se quiser)
    texto = texto.replace("&nbsp;", " ")
    return texto


def remover_textos_entre_parenteses(texto: str) -> str:
    return re.sub(r"\(.*?\)", "", texto)  # remove qualquer texto entre parenteses


def remover_espacos_duplicados(texto: str) -> str:
    return re.sub(r"\s+", " ", texto)  # remove qualquer espaço duplicado


def formatar_texto(texto: str) -> str:
    texto = remover_html_tags(texto)
    texto = remover_caracteres_especiais(texto)
    # texto = remover_textos_entre_parenteses(texto)
    texto = remover_espacos_duplicados(texto)
    return texto

# Função para converter os dados para o formato do spaCy
def converter(lang: str, DATA, output_path: Path):
    nlp = spacy.blank(lang)
    db = DocBin()
    for text, annot in tqdm(DATA):
        doc = nlp.make_doc(text)
        ents = []
        for start, end, label in annot["entities"]:
            span = doc.char_span(start, end, label=label)
            if span is None:
                msg = f"Skipping entity [{start}, {end}, {label}] in the following text because the character span '{doc.text[start:end]}' does not align with token boundaries:\n\n{repr(text)}\n"
                warnings.warn(msg)
            else:
                ents.append(span)
        doc.ents = ents
        db.add(doc)
    db.to_disk(output_path)

# formatando sentenças para treinar
# TRAIN_DATA = [ (TEXT AS A STRING, {“entities”: [(START, END, LABEL)]}) ]
def formatar(sentencas: list[str], patterns: list[dict]) -> list[tuple[str, dict[str, list[tuple[int, int, str]]]]]:
    nlp = spacy.blank("pt")

    ruler = nlp.add_pipe("entity_ruler")

    ruler.add_patterns(patterns)

    DATA = []

    for sentenca in tqdm(sentencas):
        doc = nlp(sentenca)
        entities = [(ent.start_char, ent.end_char, ent.label_) for ent in doc.ents]
        DATA.append((sentenca, {"entities": entities}))

    return DATA