/* global jsyaml */

function isSingletonObject(obj){
  return obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length === 1;
}

function normalize(value){
  if(Array.isArray(value)){
    if(value.length && value.every(v => isSingletonObject(v))){
      // turn list of singleton maps into object
      const out = {};
      for(const item of value){
        const k = Object.keys(item)[0];
        out[k] = normalize(item[k]);
      }
      return out;
    }
    return value.map(normalize);
  }
  if(value && typeof value === 'object'){
    const out = {};
    for(const [k,v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

function parseCharacters(data){
  // Top-level is a list of singleton objects: [{flip: [...]}, ...]
  return data.map(entry => {
    const id = Object.keys(entry)[0];
    const normalized = normalize(entry[id]);
    return { id, ...normalized };
  });
}

function imgPathFor(id){
  return `img/token_${id}.png`;
}

function fmtBonus(n){
  return (n >= 0 ? "+" : "") + n;
}

function groupSkillsByAbility(pericias){
  const groups = { forca:[], destreza:[], constituicao:[], inteligencia:[], sabedoria:[], carisma:[] };
  if(!pericias) return groups;
  for(const [key, p] of Object.entries(pericias)){
    const abil = p.habilidade_relacionada;
    if(groups[abil]) groups[abil].push({ key, ...p });
  }
  return groups;
}

function renderAbility(abilKey, abil){
  const classes = ["ability"]; // não destacar proficiência nas habilidades
  return `<div class="${classes.join(" ")}">
    <div class="ability-name">${abil.nome}</div>
    <div class="ability-value">${abil.valor}</div>
    <div class="ability-mod">(${fmtBonus(abil.modificador)})</div>
  </div>`;
}

function renderSavingThrows(personagem){
  const habilidades = personagem.habilidades || {};
  const order = ['forca','destreza','constituicao','inteligencia','sabedoria','carisma'];
  const items = order.map(key => {
    const abil = habilidades[key];
    if(!abil) return '';
    const cls = abil.proficiencia_resistencia ? 'saving-throw proficiente' : 'saving-throw';
    return `<div class="${cls}">${abil.nome}: ${fmtBonus(abil.modificador || 0)}</div>`;
  }).join('');
  return `<div class="saving-throws">${items}</div>`;
}

function calcSkillBonus(pericia, habilidades, bonusProf){
  const abil = habilidades[pericia.habilidade_relacionada];
  const base = abil ? (abil.modificador || 0) : 0;
  // Solicitação: não incluir bônus de proficiência no cálculo das perícias
  return base;
}

function renderSkills(personagem){
  const habilidades = personagem.habilidades || {};
  const pericias = personagem.pericias || {};
  const grouped = groupSkillsByAbility(pericias);
  const titles = {
    forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição',
    inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma'
  };
  const groupsHtml = Object.keys(grouped).map(abilKey => {
    const skills = grouped[abilKey];
    if(!skills.length) return '';
    const items = skills.map(s => {
      const bonus = calcSkillBonus(s, habilidades, personagem.bonus_proficiencia || 0);
      const cls = s.proficiencia ? 'skill proficiente' : 'skill';
      return `<div class="${cls}">${s.nome}: ${fmtBonus(bonus)}</div>`;
    }).join('');
    return `<div class="skill-group">
      <h4>${titles[abilKey] || abilKey}</h4>
      <div class="skill-list">${items}</div>
    </div>`;
  }).join('');
  return `<div class="skills">${groupsHtml}</div>`;
}

function ensureArrayFromObjectValues(obj){
  if(!obj) return [];
  if(Array.isArray(obj)) return obj;
  return Object.values(obj);
}

function buildArmasContent(personagem){
  const armas = ensureArrayFromObjectValues(personagem.armas);
  const items = armas.length ? armas.map(a => {
    const propsArr = Array.isArray(a.propriedades) ? a.propriedades : [];
    const props = propsArr.length ? propsArr.map(x=>`<span class="tag">${x}</span>`).join(' ') : '';
    // Prefer explicit field if present; else extract from propriedades like "Arremesso (alcance 20/60)"
    let alcanceTexto = a.alcance_arremesso || '';
    if(!alcanceTexto){
      for(const p of propsArr){
        const m = p.match(/alcance\s*([0-9]+\s*\/\s*[0-9]+)/i);
        if(m){ alcanceTexto = m[1].replace(/\s+/g,''); break; }
        // Fallback: capture inside parentheses after "Arremesso"
        const m2 = p.match(/arremesso[^)]*\((?:alcance\s*)?([^)]+)\)/i);
        if(m2){ alcanceTexto = m2[1].trim(); break; }
      }
    }
    const h5Class = a.proficiencia ? 'proficiente' : '';
    return `<div class="item">
      <h5 class="${h5Class}">${a.nome || 'Arma'}</h5>
      ${a.dano ? `<p><strong>Dano:</strong> ${a.dano}${a.tipo_dano ? ` (${a.tipo_dano})` : ''}</p>` : ''}
      ${alcanceTexto ? `<p><strong>Alcance de arremesso:</strong> ${alcanceTexto}</p>` : ''}
      ${props ? `<p class="weapon-tags">${props}</p>` : ''}
      ${typeof a.proficiencia === 'boolean' ? '' : ''}
    </div>`;
  }).join('') : '<p>Nenhuma arma cadastrada.</p>';
  return `<div class="modal-armas">${items}</div>`;
}

function buildMagiasContent(personagem){
  const magias = personagem.magias;
  if(!magias) return '<p>Nenhuma magia cadastrada.</p>';
  if(Array.isArray(magias)){
    if(!magias.length) return '<p>Nenhuma magia cadastrada.</p>';
    const allStrings = magias.every(m => typeof m === 'string');
    if(allStrings){
      const items = magias.map(nome => `<div class="item"><h5>${nome}</h5></div>`).join('');
      return `<div class="modal-magias">${items}</div>`;
    }
    // Array de objetos com detalhes
    const items = magias.map(m => {
      const compsColored = Array.isArray(m.componentes) ? m.componentes.map(c=>{
        const cls = `comp-${String(c).toUpperCase()}`;
        return `<span class="tag ${cls}">${c}</span>`;
      }).join(' ') : '';
      const alcanceText = (typeof m.alcance === 'number') ? `${m.alcance}m` : (typeof m.alcance !== 'undefined' ? String(m.alcance) : '');
      return `<div class="item">
        <h5>${m.nome || 'Magia'}</h5>
        ${m.descricao ? `<p>${m.descricao}</p>` : ''}
        ${m.dano ? `<p class="prop"><strong>Dano:</strong> ${m.dano}</p>` : ''}
        ${alcanceText ? `<p class="prop"><strong>Alcance:</strong> ${alcanceText}</p>` : ''}
        ${m.duracao ? `<p class="prop"><strong>Duração:</strong> ${m.duracao}</p>` : ''}
        ${compsColored ? `<p>${compsColored}</p>` : ''}
      </div>`;
    }).join('');
    return `<div class="modal-magias">${items}</div>`;
  }
  const list = ensureArrayFromObjectValues(magias);
  if(!list.length) return '<p>Nenhuma magia cadastrada.</p>';
  const items = list.map(m => {
    const comps = Array.isArray(m.componentes) ? m.componentes.map(c=>`<span class="tag">${c}</span>`).join(' ') : '';
    const compsColored = Array.isArray(m.componentes) ? m.componentes.map(c=>{
      const cls = `comp-${String(c).toUpperCase()}`;
      return `<span class="tag ${cls}">${c}</span>`;
    }).join(' ') : '';
    const alcanceText = (typeof m.alcance === 'number') ? `${m.alcance}m` : (typeof m.alcance !== 'undefined' ? String(m.alcance) : '');
    return `<div class="item">
      <h5>${m.nome || 'Magia'}</h5>
      ${m.descricao ? `<p>${m.descricao}</p>` : ''}
      ${m.dano ? `<p class="prop"><strong>Dano:</strong> ${m.dano}</p>` : ''}
      ${alcanceText ? `<p class="prop"><strong>Alcance:</strong> ${alcanceText}</p>` : ''}
      ${m.duracao ? `<p class="prop"><strong>Duração:</strong> ${m.duracao}</p>` : ''}
      ${compsColored ? `<p>${compsColored}</p>` : ''}
    </div>`;
  }).join('');
  return `<div class="modal-magias">${items}</div>`;
}

function buildEquipamentosContent(personagem){
  const equipamentos = ensureArrayFromObjectValues(personagem.equipamentos);
  if(!equipamentos.length) return '<p>Nenhum equipamento cadastrado.</p>';
  const items = equipamentos.map(e => {
    const title = e.nome || 'Equipamento';
    const parts = [];
    for(const k of Object.keys(e)){
      if(k === 'nome') continue;
      const v = e[k];
      const kl = k.toLowerCase();
      if(kl === 'propriedades'){
        const arr = Array.isArray(v) ? v : [];
        const tags = arr.length ? arr.map(x=>`<span class="tag">${x}</span>`).join(' ') : '';
        if(tags) parts.push(`<p class="equipment-tags">${tags}</p>`);
        continue;
      }
      if(kl === 'efeitos'){
        const arr = Array.isArray(v) ? v : [];
        const list = arr.length ? `<p class="effects-label"><strong>Efeitos:</strong></p><ul class="equipment-effects">${arr.map(it => {
          const txt = typeof it === 'string' ? it : (it && (it.nome || it.name || Object.values(it).join(', ')));
          return `<li>${txt || ''}</li>`;
        }).join('')}</ul>` : '';
        if(list) parts.push(list);
        continue;
      }
      if(kl === 'descricao' || k === 'descrição'){
        if(v) parts.push(`<p>${v}</p>`);
        continue;
      }
      if(kl === 'bonus' || k === 'bônus'){
        if(v) parts.push(`<p><strong>Bônus:</strong> ${v}</p>`);
        continue;
      }
      if(Array.isArray(v)){
        if(!v.length) continue;
        const content = v.map(it => typeof it === 'string' ? it : (it && (it.nome || it.name || String(it)))).join(', ');
        parts.push(`<p><strong>${k}:</strong> ${content}</p>`);
        continue;
      }
      if(v && typeof v === 'object'){
        const content = Object.entries(v).map(([kk,vv]) => `${kk}: ${vv}`).join('; ');
        parts.push(`<p><strong>${k}:</strong> ${content}</p>`);
        continue;
      }
      if(typeof v !== 'undefined' && v !== ''){
        parts.push(`<p><strong>${k}:</strong> ${v}</p>`);
      }
    }
    return `<div class="item">
      <h5>${title}</h5>
      ${parts.join('')}
    </div>`;
  }).join('');
  return `<div class="modal-equipamentos">${items}</div>`;
}

function buildTracosContent(personagem){
  const tracos = ensureArrayFromObjectValues(personagem.tracos);
  if(!tracos.length) return '<p>Nenhum traço cadastrado.</p>';
  return tracos.map(t => {
    return `<div class="item">
      <h5>${t.nome || 'Traço'}</h5>
      ${t.descricao ? `<p>${t.descricao}</p>` : ''}
    </div>`;
  }).join('');
}

function formatProficienciasList(list){
  const arr = ensureArrayFromObjectValues(list);
  if(!arr || !arr.length) return 'Nenhuma';
  return arr.map(x => typeof x === 'string' ? x : (x && (x.nome || x.name || String(x)))).join(', ');
}

function buildProficienciasContent(personagem){
  const profs = personagem.proficiencias || {};
  const profArmas = formatProficienciasList(profs.armas);
  const profArmaduras = formatProficienciasList(profs.armaduras);
  const profFerramentas = formatProficienciasList(profs.ferramentas);
  return `<div class="item proficiencias">
    <p><strong>Armas:</strong> ${profArmas}</p>
    <p><strong>Armaduras:</strong> ${profArmaduras}</p>
    <p><strong>Ferramentas:</strong> ${profFerramentas}</p>
  </div>`;
}

function buildTruquesContent(personagem){
  const truques = personagem.truques;
  if(!truques) return '<p>Nenhum truque cadastrado.</p>';
  if(Array.isArray(truques)){
    if(!truques.length) return '<p>Nenhum truque cadastrado.</p>';
    const allStrings = truques.every(t => typeof t === 'string');
    if(allStrings){
      const items = truques.map(nome => `<div class="item"><h5>${nome}</h5></div>`).join('');
      return `<div class="modal-truques">${items}</div>`;
    }
    const items = truques.map(t => {
      const compsColored = Array.isArray(t.componentes) ? t.componentes.map(c=>{
        const cls = `comp-${String(c).toUpperCase()}`;
        return `<span class="tag ${cls}">${c}</span>`;
      }).join(' ') : '';
      const alcanceText = (typeof t.alcance === 'number') ? `${t.alcance}m` : (typeof t.alcance !== 'undefined' ? String(t.alcance) : '');
      return `<div class="item">
        <h5>${t.nome || 'Truque'}</h5>
        ${t.descricao ? `<p>${t.descricao}</p>` : ''}
        ${t.dano ? `<p class="prop"><strong>Dano:</strong> ${t.dano}</p>` : ''}
        ${alcanceText ? `<p class="prop"><strong>Alcance:</strong> ${alcanceText}</p>` : ''}
        ${t.duracao ? `<p class="prop"><strong>Duração:</strong> ${t.duracao}</p>` : ''}
        ${compsColored ? `<p>${compsColored}</p>` : ''}
      </div>`;
    }).join('');
    return `<div class="modal-truques">${items}</div>`;
  }
  const list = ensureArrayFromObjectValues(truques);
  if(!list.length) return '<p>Nenhum truque cadastrado.</p>';
  const items = list.map(t => {
    const compsColored = Array.isArray(t.componentes) ? t.componentes.map(c=>{
      const cls = `comp-${String(c).toUpperCase()}`;
      return `<span class="tag ${cls}">${c}</span>`;
    }).join(' ') : '';
    const alcanceText = (typeof t.alcance === 'number') ? `${t.alcance}m` : (typeof t.alcance !== 'undefined' ? String(t.alcance) : '');
    return `<div class="item">
      <h5>${t.nome || 'Truque'}</h5>
      ${t.descricao ? `<p>${t.descricao}</p>` : ''}
      ${t.dano ? `<p class="prop"><strong>Dano:</strong> ${t.dano}</p>` : ''}
      ${alcanceText ? `<p class="prop"><strong>Alcance:</strong> ${alcanceText}</p>` : ''}
      ${t.duracao ? `<p class="prop"><strong>Duração:</strong> ${t.duracao}</p>` : ''}
      ${compsColored ? `<p>${compsColored}</p>` : ''}
    </div>`;
  }).join('');
  return `<div class="modal-truques">${items}</div>`;
}

function openModal(title, html){
  const modal = document.getElementById('modal');
  const titleEl = document.getElementById('modal-title');
  const contentEl = document.getElementById('modal-content');
  titleEl.textContent = title;
  contentEl.innerHTML = html;
  modal.setAttribute('aria-hidden','false');
}

function closeModal(){
  const modal = document.getElementById('modal');
  modal.setAttribute('aria-hidden','true');
}

function setupModalHandlers(){
  document.addEventListener('click', (e)=>{
    const target = e.target;
    if(target && target.hasAttribute('data-close-modal')){
      closeModal();
    }
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') closeModal();
  });
}

function renderCard(personagem){
  const habilidades = personagem.habilidades || {};
  const abilOrder = ['forca','destreza','constituicao','inteligencia','sabedoria','carisma'];
  const abilitiesHtml = abilOrder.map(k => habilidades[k] ? renderAbility(k, habilidades[k]) : '').join('');
  const img = imgPathFor(personagem.id);
  const idiomas = Array.isArray(personagem.idiomas) ? personagem.idiomas.join(', ') : '';
  const destrezaMod = (personagem.habilidades && personagem.habilidades.destreza && (personagem.habilidades.destreza.modificador || 0)) || 0;
  const bonusIni = typeof personagem.bonus_iniciativa !== 'undefined' ? (personagem.bonus_iniciativa || 0) : 0;
  const iniciativa = destrezaMod + bonusIni;

  return `<article class="card" id="card-${personagem.id}">
    <div class="card-header">
      <img class="avatar" src="${img}" alt="${personagem.nome_personagem || personagem.id}" onerror="this.onerror=null; this.src='img/token_${personagem.id}.gif'" />
      <div class="card-title">${personagem.nome_personagem || personagem.id}</div>
      ${typeof (personagem.nivel ?? personagem['nível']) !== 'undefined' ? `<span class="header-level">Nível ${personagem.nivel ?? personagem['nível']}</span>` : ''}
    </div>
    <div class="card-body">
      <div class="header-stats row">
        ${typeof personagem.pontos_vida !== 'undefined' ? `<div class="stat pv"><span class="icon heart"></span><span class="label">PV</span><span class="value">${personagem.pontos_vida}</span>${personagem.dado_vida ? `<span class="hit-die" aria-label="Dado de vida" title="Dado de vida">${personagem.dado_vida}</span>` : ''}</div>` : ''}
        ${typeof personagem.classe_armadura !== 'undefined' ? `<div class="stat ca"><span class="icon shield"></span><span class="label">CA</span><span class="value">${personagem.classe_armadura}</span></div>` : ''}
        ${typeof personagem.bonus_proficiencia !== 'undefined' ? `<div class="stat prof"><span class="icon star"></span><span class="label">Prof</span><span class="value">${fmtBonus(personagem.bonus_proficiencia)}</span></div>` : ''}
      </div>
      <div class="meta">
        ${personagem.raca ? `<span class="chip">${personagem.raca}</span>` : ''}
        ${personagem.classe ? `<span class="chip">${personagem.classe}</span>` : ''}
        ${idiomas ? `<span class="chip">Idiomas: ${idiomas}</span>` : ''}
        <span class="initiative">Iniciativa: ${fmtBonus(iniciativa)}</span>
      </div>

      

      <div class="section">
        <h3>Habilidades</h3>
        <div class="abilities">${abilitiesHtml}</div>
      </div>

      <div class="section">
        <h3>Testes de Resistência</h3>
        ${renderSavingThrows(personagem)}
      </div>

      <div class="section">
        <h3>Perícias</h3>
        ${renderSkills(personagem)}
      </div>

      <div class="section">
        <h3>Proficiências</h3>
        ${buildProficienciasContent(personagem)}
      </div>

      <div class="actions">
        <button class="button" data-action="armas" data-char="${personagem.id}">Armas</button>
        <button class="button" data-action="magias" data-char="${personagem.id}">Magias</button>
        <button class="button" data-action="truques" data-char="${personagem.id}">Truques</button>
        <button class="button" data-action="equipamentos" data-char="${personagem.id}">Equipamentos</button>
        <button class="button" data-action="tracos" data-char="${personagem.id}">Traços</button>
      </div>
    </div>
  </article>`;
}

async function main(){
  setupModalHandlers();
  const container = document.getElementById('cards');
  // Header nav: open armas image in modal
  const openArmas = document.getElementById('open-armas');
  if(openArmas){
    openArmas.addEventListener('click', (e)=>{
      e.preventDefault();
      const html = `<img src="img/armas.png" alt="Tabela de Armas" class="modal-image"/>`;
      openModal('Armas', html);
    });
  }
  // Header nav: open armaduras image in modal
  const openArmaduras = document.getElementById('open-armaduras');
  if(openArmaduras){
    openArmaduras.addEventListener('click', (e)=>{
      e.preventDefault();
      const html = `<img src="img/armaduras.png" alt="Tabela de Armaduras" class="modal-image"/>`;
      openModal('Armaduras', html);
    });
  }
  try{
    // Carregar ficha base
    const res = await fetch('ficha_personagens.yaml');
    const text = await res.text();
    const yaml = jsyaml.load(text);
    const personagens = parseCharacters(yaml);

    // Helper para carregar e normalizar YAMLs de catálogos
    async function loadCatalog(path, topKey){
      const r = await fetch(path);
      const t = await r.text();
      const data = normalize(jsyaml.load(t));
      return topKey && data && data[topKey] ? data[topKey] : data;
    }

    // Carregar catálogos (armas, magias, traços, truques, equipamentos)
    const [armasCatalog, magiasCatalog, tracosCatalog, truquesCatalog, equipamentosCatalog] = await Promise.all([
      loadCatalog('yaml/armas.yaml'),
      loadCatalog('yaml/magias.yaml'),
      loadCatalog('yaml/tracos.yaml'),
      loadCatalog('yaml/truques.yaml', 'truques'),
      loadCatalog('yaml/equipamentos.yaml')
    ]).catch(()=>[{}, {}, {}, {}, {}]);

    // Resolver listas por nome para objetos do catálogo
    function resolveSelection(selection, catalog){
      if(!selection) return selection;
      const toObj = (name)=>{
        const item = catalog && catalog[name];
        if(item && typeof item === 'object') return item;
        return { nome: name };
      };
      if(Array.isArray(selection)){
        return selection.map(it => typeof it === 'string' ? toObj(it) : it);
      }
      // Se já for objeto (compatibilidade com formato antigo), manter
      return selection;
    }

    // Aplicar resolução aos personagens
    for(const p of personagens){
      p.armas = resolveSelection(p.armas, armasCatalog);
      p.tracos = resolveSelection(p.tracos, tracosCatalog);
      p.magias = resolveSelection(p.magias, magiasCatalog);
      p.truques = resolveSelection(p.truques, truquesCatalog);
      p.equipamentos = resolveSelection(p.equipamentos, equipamentosCatalog);
    }

    container.innerHTML = personagens.map(renderCard).join('');

    // Event delegation for modal buttons
    container.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-action]');
      if(!btn) return;
      const id = btn.getAttribute('data-char');
      const action = btn.getAttribute('data-action');
      const personagem = personagens.find(p => p.id === id);
      if(!personagem) return;
      if(action === 'armas'){
        openModal(`Armas — ${personagem.nome_personagem || personagem.id}`, buildArmasContent(personagem));
      } else if(action === 'magias'){
        openModal(`Magias — ${personagem.nome_personagem || personagem.id}`, buildMagiasContent(personagem));
      } else if(action === 'equipamentos'){
        openModal(`Equipamentos — ${personagem.nome_personagem || personagem.id}`, buildEquipamentosContent(personagem));
      } else if(action === 'truques'){
        openModal(`Truques — ${personagem.nome_personagem || personagem.id}`, buildTruquesContent(personagem));
      } else if(action === 'tracos'){
        openModal(`Traços — ${personagem.nome_personagem || personagem.id}`, buildTracosContent(personagem));
      }
    });

  }catch(err){
    container.innerHTML = `<div class="item">Erro ao carregar: ${String(err)}</div>`;
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

main();
