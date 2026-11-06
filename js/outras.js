// Telas de vacinas, canis e pendências.

async function tentar(acao, msgErro = "Não foi possível salvar. Tente de novo.") {
  try {
    await acao();
    return true;
  } catch (err) {
    console.error(err);
    aviso(msgErro, "erro");
    return false;
  }
}

const botoesLinha = (id) => `
  <div class="linha-botoes">
    <button class="icone-btn" data-editar="${id}" aria-label="Editar">${ico("pencil", 20)}</button>
    <button class="icone-btn icone-btn-perigo" data-remover="${id}" aria-label="Remover">${ico("trash", 20)}</button>
  </div>`;

// ---------- Vacinas ----------

function camposVacina(v = {}) {
  return [
    { nome: "nome", rotulo: "Nome da vacina", ajuda: "Ex.: V10", valor: v.nome, obrigatorio: true },
    { nome: "especie", rotulo: "Para quem é?", tipo: "select", valor: v.especie || "ambos", opcoes: Object.entries(ROTULOS.especie) },
    { nome: "intervalo_dias", rotulo: "Reforço a cada quantos dias?", ajuda: "Ex.: 365 (uma vez por ano)", tipo: "number", min: 1, valor: v.intervalo_dias ?? 365, obrigatorio: true },
  ];
}

async function viewVacinas() {
  $("#app").innerHTML = `
    <div class="cabecalho-tela">
      <div><h1>Vacinas</h1><p class="subtitulo-tela">Cadastre aqui uma vez. Elas aparecem na ficha de cada animal da espécie indicada.</p></div>
      <button class="btn" id="nova">${ico("plus")} Nova vacina</button>
    </div>
    <div class="lista-simples" id="itens">
      ${Store.vacinas.map((v) => `
        <div class="linha">
          <div class="linha-info"><strong>${esc(v.nome)}</strong>
            <span>${ROTULOS.especie[v.especie]} · reforço a cada ${v.intervalo_dias} ${v.intervalo_dias === 1 ? "dia" : "dias"}</span></div>
          ${botoesLinha(v.id)}
        </div>`).join("") || `<div class="vazio"><p>Nenhuma vacina cadastrada.</p></div>`}
    </div>`;

  const dadosDe = (r) => ({ nome: r.nome.trim(), especie: r.especie, intervalo_dias: parseInt(r.intervalo_dias, 10) });
  const validos = (d) => d.nome && d.intervalo_dias > 0;

  $("#nova").onclick = async () => {
    const r = await formularioModal({ titulo: "Nova vacina", campos: camposVacina() });
    if (!r) return;
    const d = dadosDe(r);
    if (!validos(d)) return aviso("Confira o nome e o número de dias.", "erro");
    if (await tentar(() => q(sb.from("vacinas").insert(d)), "Não foi possível salvar. Talvez essa vacina já exista.")) {
      aviso("Vacina salva! ✅");
      await recarregar(viewVacinas);
    }
  };
  $("#itens").onclick = async (e) => {
    const ed = e.target.closest("[data-editar]");
    const rm = e.target.closest("[data-remover]");
    if (ed) {
      const v = Store.vacinas.find((x) => x.id === ed.dataset.editar);
      const r = await formularioModal({ titulo: "Editar vacina", campos: camposVacina(v) });
      if (!r) return;
      const d = dadosDe(r);
      if (!validos(d)) return aviso("Confira o nome e o número de dias.", "erro");
      if (await tentar(() => q(sb.from("vacinas").update(d).eq("id", v.id)), "Não foi possível salvar. Talvez essa vacina já exista.")) {
        aviso("Vacina salva! ✅");
        await recarregar(viewVacinas);
      }
    } else if (rm) {
      const v = Store.vacinas.find((x) => x.id === rm.dataset.remover);
      const usos = Store.aplicadas.filter((x) => x.vacina_id === v.id).length;
      const sim = await confirmar({
        titulo: `Remover ${v.nome}?`,
        texto: usos ? `Os ${usos} registros desta vacina nos animais também serão apagados.` : "Esta vacina será removida da lista.",
        botao: "Sim, remover",
        perigo: true,
      });
      if (sim && (await tentar(() => q(sb.from("vacinas").delete().eq("id", v.id)), "Não foi possível remover."))) {
        aviso("Vacina removida.");
        await recarregar(viewVacinas);
      }
    }
  };
}

// ---------- Canis ----------

async function viewCanis() {
  const contar = (id) => Store.animais.filter((a) => a.canil_id === id).length;
  const semCanil = Store.animais.filter((a) => !a.canil_id).length;
  const textoAnimais = (n) => `${n} ${n === 1 ? "animal" : "animais"}`;

  $("#app").innerHTML = `
    <h1>Canis e locais</h1>
    <p class="subtitulo-tela">Onde cada animal fica.</p>
    <form class="adicionar" id="novo">
      <input id="nome-canil" placeholder="Nome do novo canil" aria-label="Nome do novo canil" maxlength="60" autocomplete="off">
      <button class="btn" type="submit">${ico("plus")} Adicionar</button>
    </form>
    <div class="lista-simples" id="itens">
      ${Store.canis.map((c) => `
        <div class="linha">
          <div class="linha-info"><strong>${esc(c.nome)}</strong><span>${textoAnimais(contar(c.id))}</span></div>
          ${botoesLinha(c.id)}
        </div>`).join("") || `<div class="vazio"><p>Nenhum canil cadastrado ainda.</p></div>`}
      ${semCanil ? `<div class="linha"><div class="linha-info"><strong>Sem canil</strong><span>${textoAnimais(semCanil)}</span></div></div>` : ""}
    </div>`;

  $("#novo").onsubmit = async (e) => {
    e.preventDefault();
    const nome = $("#nome-canil").value.trim();
    if (!nome) return aviso("Escreva o nome do canil.", "erro");
    if (await tentar(() => q(sb.from("canis").insert({ nome })))) {
      aviso("Canil salvo! ✅");
      await recarregar(viewCanis);
    }
  };
  $("#itens").onclick = async (e) => {
    const ed = e.target.closest("[data-editar]");
    const rm = e.target.closest("[data-remover]");
    if (ed) {
      const c = Store.canilPorId[ed.dataset.editar];
      const r = await formularioModal({
        titulo: "Editar canil",
        campos: [{ nome: "nome", rotulo: "Nome do canil ou local", ajuda: "Ex.: Canil 3, Gatil, Quarentena", valor: c.nome, obrigatorio: true }],
      });
      if (!r?.nome.trim()) return;
      if (await tentar(() => q(sb.from("canis").update({ nome: r.nome.trim() }).eq("id", c.id)))) {
        aviso("Canil salvo! ✅");
        await recarregar(viewCanis);
      }
    } else if (rm) {
      const c = Store.canilPorId[rm.dataset.remover];
      const n = contar(c.id);
      const sim = await confirmar({
        titulo: `Remover ${c.nome}?`,
        texto: n ? `Os ${n} animais deste canil ficarão “sem canil”. Nenhum animal será apagado.` : "Este canil será removido da lista.",
        botao: "Sim, remover",
        perigo: true,
      });
      if (sim && (await tentar(() => q(sb.from("canis").delete().eq("id", c.id)), "Não foi possível remover."))) {
        aviso("Canil removido.");
        await recarregar(viewCanis);
      }
    }
  };
}

// ---------- Pendências ----------

async function viewPendencias() {
  const linhaAnimal = (a, chips) => `
    <a class="linha linha-link" href="#/animal/${a.id}/saude">
      <div class="mini-foto">${fotoOuPata(a, 30)}</div>
      <div class="linha-info"><strong>${esc(a.nome)}</strong><span>${esc(nomeCanil(a))}</span>
        <div class="chips">${chips}</div>
      </div>
    </a>`;
  const porNome = (x, y) => x.a.nome.localeCompare(y.a.nome, "pt-BR");

  const pendentes = Store.animais
    .map((a) => ({ a, itens: pendenciasDe(a) }))
    .filter(({ itens }) => itens.length)
    .sort((x, y) => y.itens.length - x.itens.length || porNome(x, y));

  // vacinas em dia, mas que vencem nos próximos dias: dá tempo de agendar
  const emBreve = Store.animais
    .filter((a) => a.status !== "adotado")
    .map((a) => ({ a, itens: resumoVacinas(a).breve }))
    .filter(({ itens }) => itens.length)
    .sort((x, y) => Math.min(...x.itens.map((i) => i.dias)) - Math.min(...y.itens.map((i) => i.dias)) || porNome(x, y));

  const quando = (d) => (d === 0 ? "hoje" : `em ${d} ${d === 1 ? "dia" : "dias"}`);

  $("#app").innerHTML = `
    <h1>Pendências de vacinas</h1>
    <p class="subtitulo-tela">Animais com vacinas faltando ou vencidas (adotados não aparecem).</p>
    <div class="lista-simples">
      ${pendentes.map(({ a, itens }) => linhaAnimal(a, itens.map((p) => `<span class="pilula vac-${p.status}">${esc(p.vacina.nome)}: ${p.status === "falta" ? "Falta" : "Vencida"}</span>`).join(""))).join("")
        || `<div class="vazio"><p>Tudo em dia!</p><p>Nenhum animal com vacina faltando ou vencida.</p></div>`}
    </div>
    ${emBreve.length ? `
    <h2 class="secao">Vencem nos próximos ${DIAS_AVISO_VACINA} dias</h2>
    <p class="subtitulo-tela">Já dá para marcar o reforço com o veterinário.</p>
    <div class="lista-simples">
      ${emBreve.map(({ a, itens }) => linhaAnimal(a, itens.sort((x, y) => x.dias - y.dias).map((i) => `<span class="pilula vac-vencida">${esc(i.vacina.nome)}: ${quando(i.dias)}</span>`).join(""))).join("")}
    </div>` : ""}`;
}
