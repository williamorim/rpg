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
  const classes = ["ability"]; if(abil.proficiencia) classes.push("proficiente");
  return `<div class="${classes.join(" ")}">
    <div class="ability-name">${abil.nome}</div>
    <div class="ability-value">${abil.valor}</div>
    <div class="ability-mod">(${fmtBonus(abil.modificador)})</div>
  </div>`;
}

function calcSkillBonus(pericia, habilidades, bonusProf){
  const abil = habilidades[pericia.habilidade_relacionada];
  const base = abil ? (abil.modificador || 0) : 0;
  const prof = pericia.proficiencia ? bonusProf : 0;
  return base + prof;
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
  if(!armas.length) return '<p>Nenhuma arma cadastrada.</p>';
  const items = armas.map(a => {
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
      ${props ? `<p>${props}</p>` : ''}
      ${typeof a.proficiencia === 'boolean' ? '' : ''}
    </div>`;
  }).join('');
  return `<div class="modal-armas">${items}</div>`;
}

function buildMagiasContent(personagem){
  const magias = personagem.magias;
  if(!magias) return '<p>Nenhuma magia cadastrada.</p>';
  if(Array.isArray(magias)){
    if(!magias.length) return '<p>Nenhuma magia cadastrada.</p>';
    const items = magias.map(nome => `<div class="item"><h5>${nome}</h5></div>`).join('');
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
    return `<div class="item">
      <h5>${m.nome || 'Magia'}</h5>
      ${m.descricao ? `<p>${m.descricao}</p>` : ''}
      ${m.dano ? `<p class="prop"><strong>Dano:</strong> ${m.dano}</p>` : ''}
      ${typeof m.alcance !== 'undefined' ? `<p class="prop"><strong>Alcance:</strong> ${m.alcance} m</p>` : ''}
      ${m.duracao ? `<p class="prop"><strong>Duração:</strong> ${m.duracao}</p>` : ''}
      ${compsColored ? `<p>${compsColored}</p>` : ''}
    </div>`;
  }).join('');
  return `<div class="modal-magias">${items}</div>`;
}

function buildEquipamentosContent(personagem){
  const equipamentos = ensureArrayFromObjectValues(personagem.equipamentos);
  if(!equipamentos.length) return '<p>Nenhum equipamento cadastrado.</p>';
  return equipamentos.map(e => {
    return `<div class="item">
      <h5>${e.nome || 'Equipamento'}</h5>
      ${e.bonus ? `<p><strong>Bônus:</strong> ${e.bonus}</p>` : ''}
    </div>`;
  }).join('');
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

  return `<article class="card" id="card-${personagem.id}">
    <div class="card-header">
      <img class="avatar" src="${img}" alt="${personagem.nome_personagem || personagem.id}" onerror="this.src='img/token_${personagem.id}.png'" />
      <div class="card-title">${personagem.nome_personagem || personagem.id}</div>
      <div class="header-stats">
        ${typeof personagem.pontos_vida !== 'undefined' ? `<div class="stat pv"><span class="icon heart"></span><span class="label">PV</span><span class="value">${personagem.pontos_vida}</span></div>` : ''}
        ${typeof personagem.classe_armadura !== 'undefined' ? `<div class="stat ca"><span class="icon shield"></span><span class="label">CA</span><span class="value">${personagem.classe_armadura}</span></div>` : ''}
        ${typeof personagem.bonus_proficiencia !== 'undefined' ? `<div class="stat prof"><span class="icon star"></span><span class="label">Prof</span><span class="value">${fmtBonus(personagem.bonus_proficiencia)}</span></div>` : ''}
      </div>
    </div>
    <div class="card-body">
      <div class="meta">
        ${personagem.raca ? `<span class="chip">${personagem.raca}</span>` : ''}
        ${personagem.classe ? `<span class="chip">${personagem.classe}</span>` : ''}
        ${idiomas ? `<span class="chip">Idiomas: ${idiomas}</span>` : ''}
      </div>

      

      <div class="section">
        <h3>Habilidades</h3>
        <div class="abilities">${abilitiesHtml}</div>
      </div>

      <div class="section">
        <h3>Perícias</h3>
        ${renderSkills(personagem)}
      </div>

      <div class="actions">
        <button class="button" data-action="armas" data-char="${personagem.id}">Armas</button>
        <button class="button" data-action="magias" data-char="${personagem.id}">Magias</button>
        <button class="button" data-action="equipamentos" data-char="${personagem.id}">Equipamentos</button>
      </div>
    </div>
  </article>`;
}

async function main(){
  setupModalHandlers();
  const container = document.getElementById('cards');
  try{
    const res = await fetch('ficha_personagens.yaml');
    const text = await res.text();
    const yaml = jsyaml.load(text);
    const personagens = parseCharacters(yaml);

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
      }
    });

  }catch(err){
    container.innerHTML = `<div class="item">Erro ao carregar: ${String(err)}</div>`;
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

main();
