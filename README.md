# Meu Bairro Conecta — Campus Facens

Mapa colaborativo de ocorrências e sugestões de mobilidade no campus Facens (UPx4 — Mobilidade e Urbanização).
Um único código web (`app/`) roda em três plataformas: **web (PWA)**, **Android** e **iOS** (via [Capacitor](https://capacitorjs.com)).

## Funcionalidades
- Mapa ilustrado do campus com Prédios A–L e Portarias 1 e 2 (horizontal no computador, vertical no celular)
- Registro de **problemas** e **sugestões de melhoria** por categoria, com foto e aviso de registro duplicado
- Confirmação social (curtida/apoio) e aviso de "precisa reconfirmar" após 30 dias
- Painel de status, ranking de locais, mapa de calor e exportação CSV (perfil **Gestão**)
- **Localização em tempo real (GPS)**: posição ao vivo no mapa com precisão e direção, botão ◎ para seguir, alerta (vibração + notificação) ao chegar a menos de 30 m de um problema ativo e aviso quando você está fora do campus
- Minha rota + alertas de ocorrências no caminho
- Integração nativa no Android/iOS: notificações, vibração, compartilhar, botão voltar do Android, barra de status e armazenamento persistente
- Funciona offline depois do primeiro acesso (service worker)

Os dados do protótipo ficam salvos no próprio aparelho (localStorage; no app nativo também em Preferences).

### Como o GPS vira posição no mapa
O mapa é uma ilustração (fora de escala). `app/data.js` traz pontos de controle com as coordenadas reais dos prédios
(OpenStreetMap) e sua posição na ilustração (`GPS_PONTOS`). O app combina uma transformação afim com uma correção local,
então cada prédio cai exatamente no lugar certo. No perfil **Gestão → Calibrar GPS aqui**, dá para acrescentar pontos
caminhando pelo campus. Na web, o GPS exige HTTPS (ou localhost).

Para testar sem sair de casa, no console do navegador:
```js
__simularGps(-23.470363, -47.429291) // Prédio E
```

## Rodar no computador
```bash
npm run dev
```
Abra http://localhost:5173.

## Publicar na internet (PWA)
A pasta `app/` é um site estático. Qualquer hospedagem gratuita serve:
- **Netlify Drop**: arraste a pasta `app/` em https://app.netlify.com/drop
- **GitHub Pages**: publique o conteúdo de `app/` num repositório e ative Pages

No celular, abra o link e use "Adicionar à tela inicial" para instalar como app.

## Android e iOS
Requer **Node 22+** (Capacitor 8).

Sempre que alterar arquivos em `app/`, rode `npx cap sync`.

**Android** — instale o [Android Studio](https://developer.android.com/studio) e rode:
```bash
npm run android
```
No Android Studio: Run ▶ (emulador ou celular) ou *Build → Generate Signed Bundle/APK* para publicar na Google Play.

**iOS** — instale o Xcode (App Store do Mac) e rode:
```bash
npm run ios
```
No Xcode: escolha um simulador e Run ▶. Para a App Store é necessária a conta Apple Developer.

Permissões já configuradas: localização "durante o uso", notificações, vibração e câmera/fotos
(`android/app/src/main/AndroidManifest.xml` e `ios/App/App/Info.plist`). O app é travado na vertical no celular.

Plugins: `@capacitor/geolocation`, `local-notifications`, `haptics`, `share`, `app`, `status-bar`, `splash-screen`, `preferences`.

Ícones e splash foram gerados a partir de `resources/` com `npx @capacitor/assets generate`.

## Documentação
`docs/UPx4 - Proposta - Meu Bairro Conecta (corrigido).docx` — proposta corrigida.
Para regerar: `NODE_PATH=<node_modules com docx> node docs/gerar_documento.js`.
