import puppeteer, { Browser } from "puppeteer";
import fs from "fs";

interface PessoaBio {
  nome: string;
  ocupacao: string | null;
  nascimento: string | null;
  biografia: string;
}

async function getLinksPessoas(browser: Browser) {
  if (fs.existsSync("../data/links_pessoas.json")) {
    return JSON.parse(
      fs.readFileSync("../data/links_pessoas.json", "utf-8")
    ) as string[];
  }

  const page = await browser.newPage(); // cria uma nova pagina
  await page.goto("https://www.ebiografia.com/catalogo.php"); // vai para a pagina de catalogo

  const linksPessoas: string[] = []; // links das pessoas

  let pageNum = 1; // numero da pagina
  while (true) {
    await page.waitForSelector(".step-pag"); // espera os botoes de proxima pagina
    const [_prevPage, nextPage] = await page.$$(".step-pag"); // botoes de proxima pagina

    await page.waitForSelector("#lista-biografias div a"); // espera os links das pessoas da pagina
    const linksPessoasDaPagina = await page.$$("#lista-biografias div a"); // links das pessoas da pagina

    for (const linkPessoa of linksPessoasDaPagina) {
      const link = await page.evaluate((link) => link.href, linkPessoa); // extrai o link
      linksPessoas.push(link); // adiciona o link na lista de links
    }

    // _prevPage contem o link para a proxima pagina
    if (pageNum === 1) {
      await _prevPage.click();
      // nextPage contem o link para a proxima pagina
    } else if (nextPage) {
      await nextPage.click();
      // se nao houver mais paginas, sai do loop
    } else {
      break;
    }
    pageNum++;
  }
  await page.close(); // fecha a pagina

  fs.writeFileSync("../data/links_pessoas.json", JSON.stringify(linksPessoas)); // salva os links das pessoas

  return linksPessoas;
}


async function getBiografias(linksPessoas: string[], browser: Browser) {
  if (fs.existsSync("../data/pessoas.json")) {
    return JSON.parse(fs.readFileSync("../data/pessoas.json", "utf-8")) as PessoaBio;
  }

  const page = await browser.newPage(); // cria uma nova pagina

  const pessoas: PessoaBio[] = []; // lista de pessoas

  for (const linkPessoa of linksPessoas) {
    await page.goto(linkPessoa); // vai para a pagina da pessoa

    await page.waitForSelector(".bio .title.nm"); // espera o nome da pessoa
    const nome = await page.$eval(".bio .title.nm", (nome) => nome.innerHTML); // extrai o nome da pessoa
    console.log("Extraindo biografia de: " + nome); // mostra o nome da pessoa

    await page.waitForSelector(".bio-job") // espera a ocupação da pessoa
    const ocupacao = await page.$eval(".bio-job", (ocupacao) => ocupacao.innerHTML); // extrai a ocupação da pessoa
    
    let nascimento: string | null = null;
    try {
      await page.waitForSelector(".infos"); // espera as infos da pessoa
      nascimento = await page.$$eval(".infos p", (infos) => {
        // nascimento is after a strong tag
        let nascimento = null;
        try {
          nascimento = infos[1].querySelector("strong")?.nextSibling?.textContent?.split(" (")[0].trim() || null;
        } catch (e) {
          console.error(e);
        }
  
        return nascimento;
      });
    } catch (e) {
      console.error(e);
    }

    await page.waitForSelector("#biografiaContent"); // espera a biografia
    const biografia = await page.$eval("#biografiaContent", (biografia) => {
      // enquanto for paragrafo e não h2, adiciona o texto
      let texto = "";
      for (const child of biografia.children) {
        if (child.tagName === "P") {
          texto += child.innerHTML;
        } else if (child.tagName === "H2") {
          break;
        }
      }
      return texto;
    });

    pessoas.push({ nome, ocupacao, nascimento, biografia }); // adiciona a pessoa na lista de pessoas
  }
  await page.close(); // fecha a pagina

  fs.writeFileSync("../data/pessoas.json", JSON.stringify(pessoas)); // salva as pessoas

  return pessoas;
}

(async () => {
  // should launch chrome
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: "/usr/bin/google-chrome",
  });

  const linksPessoas = await getLinksPessoas(browser);

  await getBiografias(linksPessoas, browser); // lista de pessoas

  await browser.close(); // fecha o navegador
})();
