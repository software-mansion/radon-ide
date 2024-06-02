# React Native IDE

## Bem vindo ao React Native IDE Beta 🎉

O React Native IDE ainda não é um produto final (por enquanto).
Esperamos que, junto com a comunidade, possamos chegar lá em breve.
Agradecemos por você ter decidido participar do programa beta e nos ajudar a melhorar esta ferramenta.

### 🚧 Quem pode usar?

O React Native IDE atualmente suporta apenas uma parte dos projetos React Native devido às diversas opções de configuração existentes. Trabalhamos constantemente para melhorar essa compatibilidade, então caso a estrutura do seu projeto não seja suportada, abra um issue sem problemas.

Abaixo listamos os requisitos básicos para os projetos que suportamos no momento:

- O React Native IDE atualmente só funciona em macOS no [VS Code](https://code.visualstudio.com/) e [Cursor](https://cursor.sh/).
- Com o React Native IDE, você só consegue rodar aplicativos iOS e Android. Se o seu projeto suporta outras plataformas, você poderá usar o IDE, mas apenas para iniciar as partes Android e iOS.
- Suportamos apenas versões recentes do React Native (0.71 em diante) e Expo SDK 49+.
- Projetos do tipo "Brownfield" (projetos que são principalmente aplicativos nativos com React Native usado em algumas telas) não são suportados no momento.

Como regra geral, se o seu projeto começou a partir de um template Expo ou do template CLI da comunidade React Native, e não se desviou muito em termos de configuração de build (ou seja, você ainda consegue rodá-lo usando expo ou react-native CLI sem passos adicionais), ele deve funcionar com o React Native IDE.

### ✨ O que ele faz?

O React Native IDE é uma extensão para o VS Code que visa simplificar o desenvolvimento de aplicativos React Native e Expo.

A versão atual suporta desenvolvimento no macOS para plataformas Android e iOS, oferecendo os seguintes recursos:

- Gerenciamento de simuladores iOS e Android (por enquanto, apenas skins para iPhone Pro e Pixel 7 estão disponíveis)
- Compilação e execução automáticas do seu projeto (mantém o controle de atualizações nativas ou JavaScript automaticamente)
- Depurador integrado sempre disponível - ao executar o projeto, você pode definir breakpoints no editor e não precisa se preocupar com nenhuma configuração adicional para que o aplicativo pare nesses pontos
- Inspetor de elementos que salta para o código do componente
- Painel de saída de log do console integrado que vincula ao arquivo/linha com a instrução de log
- Pacote de visualização que permite trabalhar em componentes isoladamente (renderizar componente único em vez de todo o aplicativo)
- Integração com Expo Router com barra de URL semelhante a um navegador
- Fácil acesso às configurações do dispositivo para tamanho do texto e modo claro/escuro

### 💽 Instalação

As instruções para a instalação estão na seção [INSTALAÇÃO](https://ide.swmansion.com/docs/installation)

### 💻 Uso

Veja [USO](https://ide.swmansion.com/docs/usage) para saber como começar após instalar a extensão. Você também pode visitar o site do [React Native IDE](https://ide.swmansion.com) onde destacamos os recursos mais importantes.

### 🐛 Troubleshooting

Para solução de problemas e orientações sobre como relatar questões, vá para a seção [TROUBLESHOOTING](https://ide.swmansion.com/docs/troubleshooting)

### ⚒️ Extension Development

If you want to develop the extension and contribute updates head to [DEVELOPMENT](https://ide.swmansion.com/docs/development) section.

Se você quer desenvolver a extensão e contribuir com atualizações, vá para a seção [DESENVOLVIMENTO](https://ide.swmansion.com/docs/development)

## Discord

Certifique-se de se juntar ao canal Discord da [Software Mansion](https://swmansion.com) usando este link de convite: https://discord.gg/jWhHbxQsPd e entre em contato conosco para ser adicionado ao canal `react-native-ide-beta`, onde discutimos questões e comunicamos nossos planos e atualizações.
