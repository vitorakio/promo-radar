# Promo Radar

Radar de promocao, cupom e erro de preco nas lojas brasileiras. Varre agregadores
(Buscape, Zoom), busca direto na Amazon e no KaBuM, acompanha a curadoria do
Promobit, compara com o historico de precos do proprio aparelho e avisa quando
aparece uma queda fora do padrao.

O mesmo codigo roda em tres lugares: aplicativo Android, extensao do Chrome e
aplicativo web. O que muda entre eles fica em `src/platform/` e nos adaptadores
de armazenamento e notificacao; a camada de servicos e a interface sao as mesmas.

## Extensao do Chrome

```bash
npm run extension:install
```

Compila e copia para `~/.local/share/promo-radar/extension`. Depois, uma vez so:
`chrome://extensions` › ligue o **modo desenvolvedor** › **Carregar sem
compactacao** › selecione esse caminho.

Instale de la, e nao de `dist-extension/`: o Chrome deriva o id da extensao do
caminho absoluto, e o id e a identidade do armazenamento. Como `dist-extension/`
e recriado do zero a cada build, apontar o Chrome para ele faz a extensao sumir
da lista durante qualquer rebuild. O diretorio de instalacao so tem o conteudo
trocado, entao o id se mantem e historico, preferencias e feed sobrevivem.

Para atualizar depois de mexer no codigo: rode o comando de novo e clique em
atualizar no card da extensao.

O que a extensao faz alem do app web:

- **Varre com o navegador fechado.** Um service worker acorda por `chrome.alarms`
  no intervalo escolhido em Alertas, varre, avisa e escreve o contador no icone.
- **Alcanca as lojas que o navegador bloqueia.** As permissoes de host do
  manifesto liberam o acesso direto a Amazon e ao KaBuM, que no app web ficam de
  fora por politica de origem. Uma varredura completa cai de dezenas de segundos
  (passando por proxy de leitura) para poucos segundos.
- **Popup e aba.** O icone abre um popup de 420x600; o menu tem "Abrir em aba"
  para quando a lista cresce.

Popup e service worker compartilham o mesmo `chrome.storage.local`, entao o feed
que aparece ao abrir o popup e o da ultima varredura de segundo plano.

Para levar a extensao a outra maquina:

```bash
npm run extension:zip   # gera promo-radar-extensao-<versao>.zip
```

Descompacte em `~/.local/share/promo-radar/extension` do outro computador e
carregue por la. O ZIP tem o `manifest.json` na raiz, que e tambem o formato que
a Chrome Web Store aceita, caso um dia queira publicar.

## APK Android

Precisa de JDK 17 e do Android SDK (com `ANDROID_HOME` apontando para ele).

```bash
npm run apk
```

Gera `dist-apk/promo-radar-<versao>.apk`, assinado e pronto para instalar:

```bash
adb install -r dist-apk/promo-radar-0.1.0.apk
```

### Chave de assinatura

O APK e assinado com a chave descrita em `keystore.properties` na raiz do
projeto. O arquivo e o `.keystore` ficam fora do controle de versao.

> **Guarde os dois.** O Android recusa atualizar um app instalado se a assinatura
> mudar: sem essa chave, a unica saida e desinstalar e reinstalar, perdendo o
> historico de precos e as preferencias.

Para criar uma chave nova (em outra maquina, por exemplo):

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore promo-radar-release.keystore \
  -alias promo-radar -keyalg RSA -keysize 2048 -validity 10000
```

E entao escreva `keystore.properties`:

```properties
storeFile=promo-radar-release.keystore
storePassword=...
keyAlias=promo-radar
keyPassword=...
```

Sem esse arquivo o build cai na chave de depuracao, que serve para testar mas nao
para distribuir.

### Sobre o diretorio `android/`

E gerado por `npx expo prebuild` e nao versionado: a configuracao de verdade esta
em `app.json` e em `plugins/`. O plugin `withReleaseSigning` reinjeta a assinatura
de release a cada prebuild, porque o template do React Native assina o release com
a chave publica de depuracao.

## Desenvolvimento

```bash
npm start          # Metro, para app e web
npm run typecheck  # tsc --noEmit
npm run icons      # regera os icones a partir de scripts/generate-icons.py
```

## Estrutura

```
App.tsx                    interface principal
src/services/              varredura, classificacao, notificacao, impostos
src/services/providers/    um modulo por fonte (Buscape, Zoom, Amazon, KaBuM, Promobit)
src/storage/               preferencias, historico de precos e cache do feed
src/platform/extension.ts  ponte com as APIs do Chrome (inerte fora da extensao)
extension/                 manifesto, service worker e adaptadores da extensao
plugins/                   config plugins do Expo aplicados no prebuild
scripts/                   builds da extensao e do APK, geracao de icones
```
