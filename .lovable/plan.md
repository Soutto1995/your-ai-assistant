

## Problema: "Adicionar à tela inicial" nao aparece

### Causas identificadas

1. **Campo `purpose` dos icones esta incorreto** -- O valor `"any maskable"` deve ser separado em duas entradas distintas no manifest. Navegadores podem rejeitar o manifest com esse formato.

2. **Icones possivelmente invalidos** -- Os arquivos `icon-192.png` e `icon-512.png` foram gerados como binarios simples e podem nao ser PNGs validos, o que impede o navegador de considerar o PWA instalavel.

3. **Sem banner de instalacao customizado** -- O Chrome so mostra o prompt automatico em condicoes especificas. Para garantir que o usuario veja a opcao, e necessario capturar o evento `beforeinstallprompt` e exibir um banner/botao manual.

4. **iOS Safari nunca mostra prompt automatico** -- No iPhone, o usuario precisa ir em Compartilhar > Adicionar a Tela de Inicio. Nao ha como forcar isso, mas podemos mostrar uma instrucao visual.

---

### Plano de implementacao

#### 1. Corrigir o `manifest.json`
Separar os icones em entradas com `purpose: "any"` e `purpose: "maskable"` individualmente:
```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

#### 2. Gerar icones PNG validos
Usar um script para criar icones PNG reais (com canvas ou ferramenta) que tenham o tamanho correto e sejam arquivos PNG validos.

#### 3. Criar componente `InstallPrompt`
Um componente React que:
- Captura o evento `beforeinstallprompt` (Android/Chrome)
- Mostra um banner fixo na parte inferior da tela com botao "Instalar Tuddo"
- Detecta iOS e mostra instrucao: "Toque em Compartilhar e depois em 'Adicionar a Tela de Inicio'"
- Se esconde apos instalacao ou dismissal (salva no localStorage)

#### 4. Adicionar o componente no App.tsx
Renderizar `<InstallPrompt />` dentro do layout principal.

---

### Arquivos modificados
- `public/manifest.json` -- correcao dos icones
- `public/icon-192.png` e `icon-512.png` -- regenerar como PNGs validos
- `src/components/InstallPrompt.tsx` -- novo componente
- `src/App.tsx` -- incluir o componente

