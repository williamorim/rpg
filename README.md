# rpg

Estrutura de dados (YAML):
- `ficha_personagens.yaml`: lista os personagens. Agora, os campos `armas`, `magias`, `truques` e `traços` podem ser apenas nomes/ids, e os detalhes são buscados nos catálogos.
- Catálogos em `yaml/`:
	- `yaml/armas.yaml` – catálogo de armas.
	- `yaml/magias.yaml` – catálogo de magias.
	- `yaml/tracos.yaml` – catálogo de traços.
	- `yaml/truques.yaml` – catálogo de truques (topo: `truques`).
	- `yaml/equipamentos.yaml` – catálogo de equipamentos.

Como funciona:
- O site carrega `ficha_personagens.yaml` e os catálogos.
- Para cada personagem, os nomes listados em `armas`, `magias`, `truques` e `tracos` são resolvidos para os objetos do catálogo com mesmo id.
- Se algum nome não existir no catálogo, será mostrado apenas o nome.

Observações:
- O formato antigo (detalhes embutidos no personagem) continua funcionando. Misturar nomes e objetos também é suportado.