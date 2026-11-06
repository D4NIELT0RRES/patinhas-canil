// Telas de animais: lista, formulário e ficha.

const filtros = { busca: "", canil: "", status: "", especie: "", sexo: "", porte: "", cor: "", idade: "", ordem: "nome" };

const FAIXAS_IDADE = {
  filhote: ["Filhote (menos de 1 ano)", 0, 11],
  jovem: ["Jovem (1 a 2 anos)", 12, 35],
  adulto: ["Adulto (3 a 7 anos)", 36, 95],
  idoso: ["Idoso (8 anos ou mais)", 96, Infinity],
};

const ORDENS = {
  nome: "Nome",
  idade_asc: "Mais novos primeiro",
  idade_desc: "Mais velhos primeiro",
  ong_desc: "Mais tempo na ONG",
  ong_asc: "Chegaram há menos tempo",
};

const nomeCanil = (a) => Store.canilPorId[a.canil_id]?.nome || "Sem canil";

// animais adotados já saíram do canil: não contam como pendência
const pendenciasDe = (a) => (a.status === "adotado" ? [] : resumoVacinas(a).pendentes);

const textoBusca = (a) =>
  norm(
    [a.nome, a.raca, a.cor, nomeCanil(a), a.doencas, a.limitacoes, a.observacoes, ROTULOS.especie[a.especie],
     ROTULOS.sexo[a.sexo], ROTULOS.porte[a.porte], ROTULOS.status[a.status]].join(" ")
  );

// datas ISO comparam como texto; datas vazias vão para o fim
function cmpData(x, y, sentido) {
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return x < y ? -sentido : x > y ? sentido : 0;
}

function filtrarOrdenar() {
  const termos = norm(filtros.busca).split(/\s+/).filter(Boolean);
  const cor = norm(filtros.cor.trim());
  const faixa = FAIXAS_IDADE[filtros.idade];
  const lista = Store.animais.filter((a) => {
    if (filtros.canil === "_sem" ? a.canil_id : filtros.canil && a.canil_id !== filtros.canil) return false;
    for (const k of ["status", "especie", "sexo", "porte"]) if (filtros[k] && a[k] !== filtros[k]) return false;
    if (cor && !norm(a.cor).includes(cor)) return false;
    if (faixa) {
      const m = mesesDesde(a.data_nascimento);
      if (m == null || m < faixa[1] || m > faixa[2]) return false;
    }
    if (termos.length) {
      const t = textoBusca(a);
      return termos.every((x) => t.includes(x));
    }
    return true;
  });
  const o = filtros.ordem;
  const porNome = (a, b) => a.nome.localeCompare(b.nome, "pt-BR");
  lista.sort((a, b) => {
    if (o === "idade_asc") return cmpData(a.data_nascimento, b.data_nascimento, -1) || porNome(a, b);
    if (o === "idade_desc") return cmpData(a.data_nascimento, b.data_nascimento, 1) || porNome(a, b);
    if (o === "ong_desc") return cmpData(a.data_entrada, b.data_entrada, 1) || porNome(a, b);
    if (o === "ong_asc") return cmpData(a.data_entrada, b.data_entrada, -1) || porNome(a, b);
    return porNome(a, b);
  });
  return lista;
}

const fotoOuPata = (a, tam) =>
  a.foto_url ? `<img src="${esc(a.foto_url)}" alt="Foto de ${esc(a.nome)}" loading="lazy">` : `<span class="sem-foto">${ico("paw", tam)}</span>`;

function cardAnimal(a) {
  const pend = pendenciasDe(a).length;
  const meta = (...partes) => partes.filter(Boolean).map(esc).join(" · ");
  return `<a class="card" href="#/animal/${a.id}">
    <div class="card-foto">
      ${fotoOuPata(a, 72)}
      ${pend ? `<span class="selo selo-alerta">${ico("alert", 14)} ${pend} ${pend === 1 ? "vacina pendente" : "vacinas pendentes"}</span>` : ""}
      ${a.observacoes ? `<span class="selo selo-obs">${ico("nota", 14)} Tem observações</span>` : ""}
    </div>
    <div class="card-corpo">
      <div class="linha-nome"><h3>${esc(a.nome)}</h3><span class="pilula st-${a.status}">${ROTULOS.status[a.status]}</span></div>
      <p class="meta">${meta(a.raca, fmtDuracao(mesesDesde(a.data_nascimento)))}</p>
      <p class="meta">${meta(a.cor, ROTULOS.porte[a.porte]) || "&nbsp;"}</p>
      <p class="canil">${esc(nomeCanil(a))}</p>
    </div></a>`;
}

const opcoesSelect = (itens, atual, vazio) =>
  `<option value="">${vazio}</option>` +
  itens.map(([v, r]) => `<option value="${esc(v)}" ${v === atual ? "selected" : ""}>${esc(r)}</option>`).join("");

// Números do topo da lista: visão rápida da situação do canil
function painelNumeros() {
  if (!Store.animais.length) return "";
  const noCanil = Store.animais.filter((a) => a.status !== "adotado");
  const comPendencia = noCanil.filter((a) => pendenciasDe(a).length).length;
  const aVencer = noCanil.reduce((n, a) => n + resumoVacinas(a).breve.length, 0);
  const conta = (st) => Store.animais.filter((a) => a.status === st).length;
  const itens = [
    ["Animais", Store.animais.length, "", ""],
    ["Disponíveis", conta("disponivel"), "", ""],
    ["Em tratamento", conta("tratamento"), "", ""],
    ["Com pendências", comPendencia, "#/pendencias", comPendencia ? "numero-alerta" : ""],
    ["Vacinas a vencer", aVencer, "#/pendencias", aVencer ? "numero-atencao" : ""],
  ];
  return `<div class="numeros">${itens.map(([r, n, href, c]) => `<${href ? `a href="${href}"` : "div"} class="numero ${c}"><strong>${n}</strong><span>${r}</span></${href ? "a" : "div"}>`).join("")}</div>`;
}

async function viewLista() {
  const cores = [...new Set(Store.animais.map((a) => (a.cor || "").trim()).filter(Boolean))].sort((x, y) => x.localeCompare(y, "pt-BR"));
  const canisOp = [["_sem", "Sem canil"], ...Store.canis.map((c) => [c.id, c.nome])];
  const sel = (id, rotulo, itens, vazio) =>
    `<select id="f_${id}" aria-label="${rotulo}">${opcoesSelect(itens, filtros[id], vazio)}</select>`;

  $("#app").innerHTML = `
    <h1>Nossos animais</h1>
    <p id="contagem" class="subtitulo-tela"></p>
    ${painelNumeros()}
    <div class="busca-wrap">${ico("search", 24)}
      <input id="busca" class="busca" type="search" placeholder="Buscar nome, raça, canil..." value="${esc(filtros.busca)}" autocomplete="off" aria-label="Buscar animais">
    </div>
    <div class="barra">
      <button class="btn btn-contorno" id="btnFiltros" aria-expanded="false">${ico("sliders")} Filtros <span id="contFiltros" class="contador" hidden></span></button>
      <select id="f_ordem" class="ordem" aria-label="Ordenar por">${Object.entries(ORDENS).map(([v, r]) => `<option value="${v}" ${v === filtros.ordem ? "selected" : ""}>Ordenar: ${r}</option>`).join("")}</select>
    </div>
    <div id="painel" class="painel" hidden>
      ${sel("canil", "Canil ou local", canisOp, "Todos os canis")}
      ${sel("status", "Status", Object.entries(ROTULOS.status), "Todos os status")}
      ${sel("especie", "Espécie", [["cachorro", "Cachorro"], ["gato", "Gato"]], "Cães e gatos")}
      ${sel("sexo", "Sexo", Object.entries(ROTULOS.sexo), "Qualquer sexo")}
      ${sel("porte", "Porte", Object.entries(ROTULOS.porte), "Qualquer porte")}
      ${sel("idade", "Faixa de idade", Object.entries(FAIXAS_IDADE).map(([k, v]) => [k, v[0]]), "Qualquer idade")}
      <input id="f_cor" class="campo-filtro" list="lista-cores" placeholder="Qualquer cor" aria-label="Cor" value="${esc(filtros.cor)}" autocomplete="off">
      <datalist id="lista-cores">${cores.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
      <button class="btn btn-suave" id="limpar">Limpar filtros</button>
    </div>
    <div id="lista" class="grade"></div>
    <a href="#/animal/novo" class="fab">${ico("plus", 24)} Novo animal</a>`;

  const atualizar = () => {
    const lista = filtrarOrdenar();
    const ativos = ["canil", "status", "especie", "sexo", "porte", "idade"].filter((k) => filtros[k]).length + (filtros.cor.trim() ? 1 : 0);
    $("#contFiltros").textContent = ativos;
    $("#contFiltros").hidden = !ativos;
    $("#contagem").textContent = `${lista.length} de ${Store.animais.length} ${Store.animais.length === 1 ? "animal" : "animais"}`;
    $("#lista").innerHTML = lista.length
      ? lista.map(cardAnimal).join("")
      : Store.animais.length
        ? `<div class="vazio"><p>Nenhum animal encontrado.</p><p>Tente mudar a busca ou limpar os filtros.</p></div>`
        : `<div class="vazio"><p>Nenhum animal cadastrado ainda.</p><p>Toque em <strong>Novo animal</strong> para começar.</p></div>`;
  };

  $("#busca").oninput = (e) => ((filtros.busca = e.target.value), atualizar());
  $("#btnFiltros").onclick = (e) => {
    const painel = $("#painel");
    painel.hidden = !painel.hidden;
    e.currentTarget.setAttribute("aria-expanded", String(!painel.hidden));
    e.currentTarget.classList.toggle("aberto", !painel.hidden);
  };
  for (const k of ["canil", "status", "especie", "sexo", "porte", "idade", "cor", "ordem"]) {
    $(`#f_${k}`).oninput = (e) => ((filtros[k] = e.target.value), atualizar());
  }
  $("#limpar").onclick = () => {
    for (const k of ["canil", "status", "especie", "sexo", "porte", "idade", "cor"]) {
      filtros[k] = "";
      $(`#f_${k}`).value = "";
    }
    atualizar();
  };
  if (["canil", "status", "especie", "sexo", "porte", "idade", "cor"].some((k) => filtros[k])) $("#btnFiltros").click();
  atualizar();
}

// ---------- Formulário ----------

const grupo = (nome, itens, atual) =>
  `<div class="seg" role="radiogroup">${itens
    .map(([v, r]) => `<input type="radio" id="${nome}_${v}" name="${nome}" value="${v}" ${v === atual ? "checked" : ""}>
      <label for="${nome}_${v}">${r}</label>`)
    .join("")}</div>`;

const campo = (rotulo, ajuda, conteudo, id) =>
  `<div class="campo"><label ${id ? `for="${id}"` : ""} class="rotulo">${rotulo}</label>${conteudo}<p class="ajuda">${ajuda}</p></div>`;

async function viewForm(id) {
  const a = id ? Store.animais.find((x) => x.id === id) : null;
  if (id && !a) return naoEncontrado("Animal não encontrado.");
  const v = a || { status: "disponivel", castrado: false, data_entrada: hojeISO() };
  const hoje = hojeISO();
  const voltarPara = a ? `#/animal/${a.id}` : "#/animais";
  let arquivoFoto = null;

  const canisHtml = Store.canis.length
    ? `<select id="canil_id" name="canil_id"><option value="">Sem canil</option>${Store.canis
        .map((c) => `<option value="${c.id}" ${c.id === v.canil_id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select>`
    : `<p class="aviso-caixa">Nenhum canil cadastrado ainda. <a href="#/canis">Cadastre um canil</a> e volte aqui. (Você também pode salvar sem canil.)</p>`;

  $("#app").innerHTML = `
    <h1>${a ? "Editar animal" : "Novo animal"}</h1>
    <form id="form" class="formulario" novalidate>
      <div class="campo">
        <span class="rotulo">Foto</span>
        <label class="foto-area" for="foto" id="previa">
          ${v.foto_url ? `<img src="${esc(v.foto_url)}" alt="Foto atual">` : `${ico("camera", 44)}<span>Tirar foto ou escolher da galeria</span>`}
        </label>
        <input class="oculto" type="file" id="foto" accept="image/*">
        <button type="button" class="btn btn-suave btn-ia-foto" id="ia-foto" hidden>${ico("sparkles")} Preencher com IA pela foto</button>
        <p class="ajuda" id="ajuda-foto">No celular, o aparelho pergunta se você quer abrir a câmera ou a galeria.</p>
      </div>
      ${campo("Nome *", "Como o animal é chamado. Ex.: Mel", `<input id="nome" name="nome" value="${esc(v.nome)}" placeholder="Ex.: Pipoca" required maxlength="80" autocomplete="off">`, "nome")}
      ${campo("Espécie *", "Escolha cachorro ou gato.", grupo("especie", [["cachorro", "Cachorro"], ["gato", "Gato"]], v.especie))}
      ${campo("Sexo *", "Macho ou fêmea.", grupo("sexo", [["macho", "Macho"], ["femea", "Fêmea"]], v.sexo))}
      ${campo("Raça", "Se não souber, escreva SRD (sem raça definida). Ex.: Labrador", `<input id="raca" name="raca" value="${esc(v.raca)}" maxlength="80">`, "raca")}
      ${campo("Cor", "Descreva a cor do pelo. Ex.: caramelo com patas brancas", `<input id="cor" name="cor" value="${esc(v.cor)}" maxlength="80">`, "cor")}
      ${campo("Data de nascimento (aproximada)", "Não sabe ao certo? Coloque uma data aproximada. A idade é calculada sozinha.", `<input id="data_nascimento" name="data_nascimento" type="date" max="${hoje}" value="${esc(v.data_nascimento)}">`, "data_nascimento")}
      ${campo("Porte", "Pequeno: até 10 kg · Médio: 10 a 25 kg · Grande: mais de 25 kg.", grupo("porte", [["pequeno", "Pequeno"], ["medio", "Médio"], ["grande", "Grande"]], v.porte))}
      ${campo("Castrado(a)?", "Marque “Sim” se o animal já foi castrado.", grupo("castrado", [["sim", "Sim"], ["nao", "Não"]], v.castrado ? "sim" : "nao"))}
      ${campo("Data de entrada na ONG", "Dia em que o animal chegou à ONG.", `<input id="data_entrada" name="data_entrada" type="date" max="${hoje}" value="${esc(v.data_entrada)}">`, "data_entrada")}
      ${campo("Canil / local", "Onde o animal está agora.", canisHtml, "canil_id")}
      ${campo("Status *", "Situação atual do animal.", `<select id="status" name="status">${Object.entries(ROTULOS.status).map(([k, r]) => `<option value="${k}" ${k === v.status ? "selected" : ""}>${r}</option>`).join("")}</select>`, "status")}
      ${campo("Observações", "Escreva qualquer coisa importante. Ex.: não gosta de outros machos, tem medo de trovão, usa coleira peitoral.", `<textarea id="observacoes" name="observacoes" rows="4" maxlength="2000">${esc(v.observacoes)}</textarea>`, "observacoes")}
      ${campo("Doenças e condições", "Se tiver. Ex.: dermatite, FIV, cardiopatia.", `<textarea id="doencas" name="doencas" rows="3" maxlength="2000">${esc(v.doencas)}</textarea>`, "doencas")}
      ${campo("Limitações e cuidados especiais", "Se tiver. Ex.: cego de um olho, ração especial, não pode subir escada.", `<textarea id="limitacoes" name="limitacoes" rows="3" maxlength="2000">${esc(v.limitacoes)}</textarea>`, "limitacoes")}
      <p id="erro-form" class="erro" hidden></p>
      <div class="barra-form">
        <a class="btn btn-contorno" href="${voltarPara}">Cancelar</a>
        <button class="btn" id="salvar" type="submit">Salvar</button>
      </div>
    </form>`;

  $("#foto").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    arquivoFoto = f;
    $("#previa").innerHTML = `<img src="${URL.createObjectURL(f)}" alt="Foto escolhida">`;
    $("#ia-foto").hidden = false;
    $("#ajuda-foto").textContent = "A IA pode sugerir espécie, raça, cor e porte pela foto. Você confere antes de salvar.";
  };

  // A IA olha a foto e sugere os campos que ainda estão vazios
  $("#ia-foto").onclick = async (e) => {
    const botao = e.currentTarget;
    botao.disabled = true;
    botao.textContent = "Analisando a foto...";
    try {
      const sug = await sugerirPelaFoto(arquivoFoto);
      const f = $("#form");
      const preenchidos = [];
      if (sug.especie && !f.elements.especie.value) (f.querySelector(`#especie_${sug.especie}`).checked = true), preenchidos.push("espécie");
      if (sug.porte && !f.elements.porte.value) (f.querySelector(`#porte_${sug.porte}`).checked = true), preenchidos.push("porte");
      if (sug.raca && !f.elements.raca.value.trim()) (f.elements.raca.value = sug.raca), preenchidos.push("raça");
      if (sug.cor && !f.elements.cor.value.trim()) (f.elements.cor.value = sug.cor), preenchidos.push("cor");
      aviso(preenchidos.length ? `A IA sugeriu: ${preenchidos.join(", ")}. Confira antes de salvar.` : "A IA não achou nada novo para preencher.");
    } catch (err) {
      console.error(err);
      aviso(mensagemErroIA(err), "erro");
    }
    botao.disabled = false;
    botao.innerHTML = `${ico("sparkles")} Preencher com IA pela foto`;
  };

  $("#form").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const erro = $("#erro-form");
    const dado = (n) => f.elements[n].value.trim() || null;
    const falta = !f.elements.nome.value.trim() ? "Escreva o nome do animal."
      : !f.elements.especie.value ? "Escolha a espécie: cachorro ou gato."
      : !f.elements.sexo.value ? "Escolha o sexo: macho ou fêmea." : "";
    erro.hidden = !falta;
    erro.textContent = falta;
    if (falta) return erro.scrollIntoView({ block: "center", behavior: "smooth" });

    const botao = $("#salvar");
    botao.disabled = true;
    botao.textContent = "Salvando...";
    let novaFoto = null;
    try {
      const dados = {
        nome: f.elements.nome.value.trim(),
        especie: f.elements.especie.value,
        sexo: f.elements.sexo.value,
        raca: dado("raca"),
        cor: dado("cor"),
        data_nascimento: dado("data_nascimento"),
        porte: f.elements.porte.value || null,
        castrado: f.elements.castrado.value === "sim",
        data_entrada: dado("data_entrada"),
        canil_id: f.elements.canil_id?.value || null,
        status: f.elements.status.value,
        observacoes: dado("observacoes"),
        doencas: dado("doencas"),
        limitacoes: dado("limitacoes"),
      };
      if (arquivoFoto) {
        novaFoto = await enviarFoto(arquivoFoto);
        Object.assign(dados, novaFoto);
      }
      let salvo;
      if (a) {
        salvo = (await q(sb.from("animais").update(dados).eq("id", a.id).select()))[0];
        if (novaFoto) await removerFoto(a.foto_path);
      } else {
        salvo = (await q(sb.from("animais").insert(dados).select()))[0];
      }
      aviso("Animal salvo com sucesso! ✅");
      location.hash = `#/animal/${salvo.id}`;
    } catch (err) {
      console.error(err);
      if (novaFoto) await removerFoto(novaFoto.foto_path);
      erro.hidden = false;
      erro.textContent = "Não foi possível salvar. Verifique a internet e tente de novo.";
      botao.disabled = false;
      botao.textContent = "Salvar";
    }
  };
}

// ---------- Ficha ----------

const dadoFicha = (rot, val) => `<div class="dado"><dt>${rot}</dt><dd>${esc(val || "—")}</dd></div>`;
const textoLivre = (t) => esc(t).replace(/\n/g, "<br>");

function fichaDados(a) {
  return `
    <div class="destaque ${a.observacoes ? "" : "destaque-vazio"}"><h3>${ico("nota", 20)} Observações</h3><p>${a.observacoes ? textoLivre(a.observacoes) : "Nenhuma observação cadastrada."}</p></div>
    <dl class="dados">
      ${dadoFicha("Idade", fmtDuracao(mesesDesde(a.data_nascimento)))}
      ${dadoFicha("Tempo na ONG", fmtDuracao(mesesDesde(a.data_entrada)))}
      ${dadoFicha("Espécie", ROTULOS.especie[a.especie])}${dadoFicha("Sexo", ROTULOS.sexo[a.sexo])}
      ${dadoFicha("Raça", a.raca)}${dadoFicha("Porte", ROTULOS.porte[a.porte])}
      ${dadoFicha("Cor", a.cor)}${dadoFicha("Castrado(a)", a.castrado ? "Sim" : "Não")}
      ${dadoFicha("Canil / local", nomeCanil(a))}
      ${dadoFicha("Nascimento", a.data_nascimento ? fmtData(a.data_nascimento) : "")}
      ${dadoFicha("Entrada na ONG", a.data_entrada ? fmtData(a.data_entrada) : "")}
    </dl>`;
}

function fichaSaude(a) {
  const r = resumoVacinas(a);
  const linhas = r.itens.map(({ vacina, status, aplicada, proxima, dias }) => {
    const detalhe = status === "falta" ? "Ainda não tomou"
      : status === "vencida" ? `Tomou em ${fmtData(aplicada)} · Venceu em <b>${fmtData(proxima)}</b>`
      : `Tomou em ${fmtData(aplicada)} · Próxima: <b>${fmtData(proxima)}</b>${dias <= DIAS_AVISO_VACINA ? ` · <b class="breve">${dias === 0 ? "vence hoje" : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`}</b>` : ""}`;
    return `<div class="vac vac-${status}">
      <label class="check"><input type="checkbox" data-vac="${vacina.id}" ${status !== "falta" ? "checked" : ""} aria-label="Vacina ${esc(vacina.nome)} aplicada"><span>${ico("check", 28)}</span></label>
      <div class="vac-info"><div><strong>${esc(vacina.nome)}</strong> <span class="pilula vac-${status}">${ROTULOS.vacina[status]}</span></div><small>${detalhe}</small></div>
      ${status !== "falta" ? `<button class="btn btn-suave btn-peq" data-nova="${vacina.id}">Nova dose</button>` : ""}
      <span class="bolinha vac-${status}" aria-hidden="true"></span>
    </div>`;
  });
  return `
    <div class="duas-colunas">
      <div class="caixa"><h3>Doenças e condições</h3><p>${a.doencas ? textoLivre(a.doencas) : "Nenhuma informada."}</p></div>
      <div class="caixa"><h3>Limitações e cuidados especiais</h3><p>${a.limitacoes ? textoLivre(a.limitacoes) : "Nenhuma informada."}</p></div>
    </div>
    <section class="caixa caixa-vacinas">
      <h2>Vacinas</h2>
      <div class="resumo-vac">
        <span class="pilula vac-ok">${r.ok} em dia</span>
        <span class="pilula vac-vencida">${r.vencidas} ${r.vencidas === 1 ? "vencida" : "vencidas"}</span>
        <span class="pilula vac-falta">${r.faltando} faltando</span>
      </div>
      ${linhas.join("") || `<p class="aviso-caixa">Nenhuma vacina cadastrada para esta espécie. Cadastre na área <a href="#/vacinas">Vacinas</a>.</p>`}
    </section>`;
}

async function registrarDose(a, vacinaId) {
  const vac = Store.vacinas.find((x) => x.id === vacinaId);
  const res = await formularioModal({
    titulo: `${vac.nome} aplicada`,
    texto: `Em que dia ${a.nome} tomou esta vacina?`,
    botao: "Salvar data",
    campos: [{ nome: "data", rotulo: "Data da vacina", tipo: "date", valor: hojeISO(), max: hojeISO(), obrigatorio: true }],
  });
  if (!res) return false;
  await q(sb.from("vacinas_aplicadas").upsert({ animal_id: a.id, vacina_id: vacinaId, data_aplicacao: res.data }, { onConflict: "animal_id,vacina_id" }));
  aviso("Vacina registrada! ✅");
  return true;
}

async function desfazerDose(a, vacinaId) {
  const vac = Store.vacinas.find((x) => x.id === vacinaId);
  const sim = await confirmar({
    titulo: "Desfazer registro?",
    texto: `O registro da vacina ${vac.nome} de ${a.nome} será apagado e ela voltará a aparecer como “falta”.`,
    botao: "Sim, desfazer",
    perigo: true,
  });
  if (!sim) return false;
  await q(sb.from("vacinas_aplicadas").delete().eq("animal_id", a.id).eq("vacina_id", vacinaId));
  aviso("Registro removido.");
  return true;
}

async function viewFicha(id, aba) {
  const a = Store.animais.find((x) => x.id === id);
  if (!a) return naoEncontrado("Animal não encontrado. Ele pode ter sido excluído.");
  let abaAtual = aba === "saude" ? "saude" : "dados";
  const chatEstado = { msgs: [], pensando: false }; // a conversa não se perde ao trocar de aba
  const pend = pendenciasDe(a).length;

  $("#app").innerHTML = `
    <a class="voltar" href="#/animais">${ico("voltar", 20)} Voltar</a>
    <section class="ficha-card">
      <div class="ficha-foto">${fotoOuPata(a, 96)}</div>
      <div class="ficha-corpo">
        <div class="linha-nome"><h1>${esc(a.nome)}</h1><span class="pilula st-${a.status}">${ROTULOS.status[a.status]}</span></div>
        <div class="fatos">
          <span class="fato">Cor: ${esc(a.cor || "não informada")}</span>
          <span class="fato">Porte: ${esc((ROTULOS.porte[a.porte] || "não informado").toLowerCase())}</span>
          ${a.data_nascimento ? `<span class="fato">${esc(fmtDuracao(mesesDesde(a.data_nascimento)))}</span>` : ""}
        </div>
        <div class="acoes">
          <a class="btn btn-suave" href="#/animal/${a.id}/editar">${ico("pencil")} Editar</a>
          <button class="btn btn-contorno-perigo" id="excluir">${ico("trash")} Excluir</button>
        </div>
        <div class="acoes acoes-extra">
          <button class="btn btn-contorno" id="adocao">${ico("sparkles")} Texto de adoção</button>
          <button class="btn btn-contorno" id="qr">${ico("qr")} QR Code</button>
        </div>
      </div>
    </section>
    <div class="abas" role="tablist">
      <button role="tab" data-aba="dados">Dados</button>
      <button role="tab" data-aba="saude">Saúde ${pend ? `<span class="contador">${pend}</span>` : ""}</button>
      <button role="tab" data-aba="ia">${ico("sparkles", 18)} Assistente</button>
    </div>
    <div id="conteudo"></div>`;

  const mostrar = () => {
    for (const b of document.querySelectorAll(".abas button")) {
      b.classList.toggle("ativa", b.dataset.aba === abaAtual);
      b.setAttribute("aria-selected", String(b.dataset.aba === abaAtual));
    }
    if (abaAtual === "ia") {
      $("#conteudo").innerHTML = `<div id="chat-ficha"></div>`;
      montarChat($("#chat-ficha"), { animal: a, estado: chatEstado });
    } else {
      $("#conteudo").innerHTML = abaAtual === "saude" ? fichaSaude(a) : fichaDados(a);
    }
  };
  for (const b of document.querySelectorAll(".abas button")) b.onclick = () => ((abaAtual = b.dataset.aba), mostrar());

  async function aplicar(acao) {
    try {
      if (await acao()) {
        await carregarTudo();
        mostrar();
      }
    } catch (err) {
      console.error(err);
      aviso("Não foi possível salvar. Tente de novo.", "erro");
    }
  }
  $("#conteudo").onclick = (e) => {
    const nova = e.target.closest("[data-nova]");
    if (nova) aplicar(() => registrarDose(a, nova.dataset.nova));
  };
  $("#conteudo").onchange = (e) => {
    const cb = e.target.closest("input[data-vac]");
    if (!cb) return;
    const marcou = cb.checked;
    cb.checked = !marcou; // só muda de verdade depois de confirmar
    aplicar(() => (marcou ? registrarDose(a, cb.dataset.vac) : desfazerDose(a, cb.dataset.vac)));
  };

  $("#adocao").onclick = () => abrirTextoAdocao(a);
  $("#qr").onclick = () => abrirQR(a);

  $("#excluir").onclick = async () => {
    const sim = await confirmar({
      titulo: `Excluir ${a.nome}?`,
      texto: "Todos os dados e as vacinas deste animal serão apagados e não poderão ser recuperados.",
      botao: "Sim, excluir",
      perigo: true,
    });
    if (!sim) return;
    try {
      await q(sb.from("animais").delete().eq("id", a.id));
      await removerFoto(a.foto_path);
      aviso("Animal excluído.");
      location.hash = "#/animais";
    } catch (err) {
      console.error(err);
      aviso("Não foi possível excluir. Tente de novo.", "erro");
    }
  };
  mostrar();
}

// ---------- QR Code do animal (para a plaquinha do canil) ----------

const QR_SRC = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";

const carregarScript = (src) =>
  new Promise((ok, falha) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = ok;
    el.onerror = () => falha(new Error("Não foi possível carregar o gerador de QR Code."));
    document.head.appendChild(el);
  });

async function abrirQR(a) {
  const { el, fechar } = abrirModal(`<h2>QR Code de ${esc(a.nome)}</h2><div class="carregando"><div class="roda"></div></div>`, null, "modal-qr");
  try {
    if (!window.qrcode) await carregarScript(QR_SRC);
    const link = `${location.origin}${location.pathname}#/animal/${a.id}`;
    const qr = window.qrcode(0, "M");
    qr.addData(link);
    qr.make();
    el.innerHTML = `
      <div class="qr-imprimir">
        <h2>${esc(a.nome)}</h2>
        <div class="qr-svg">${qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true, alt: `QR Code da ficha de ${a.nome}` })}</div>
        <p>Aponte a câmera do celular para abrir a ficha.</p>
      </div>
      <div class="modal-botoes">
        <button class="btn btn-contorno" data-fechar>Fechar</button>
        <button class="btn" data-imprimir>${ico("print")} Imprimir</button>
      </div>`;
    $("[data-fechar]", el).onclick = fechar;
    $("[data-imprimir]", el).onclick = () => window.print();
  } catch (e) {
    console.error(e);
    el.innerHTML = `<h2>QR Code</h2><p class="erro">${esc(e.message)}</p><div class="modal-botoes"><button class="btn btn-contorno" data-fechar>Fechar</button></div>`;
    $("[data-fechar]", el).onclick = fechar;
  }
}
