## Índice

- [Descrição do Projeto](#descrição-do-projeto)
- [Instalação e Uso Local](#instalação-e-uso-local)
- [Compilar o TypeScript](#compilar-o-typescript)
- [Manual do Usuário](#manual-do-usuário)
- [O que funcionou](#o-que-funcionou)
- [O que não funcionou](#o-que-não-funcionou)

---

## Descrição do Projeto

**Acadêmico** é um site para criação e gestão de projetos acadêmicos em equipe. Os usuários criam projetos, convidam colegas, distribuem tarefas e acompanham o progresso com comentários atualizados em tempo real.

O frontend é um site estático (HTML, CSS e JavaScript) que se comunica com a [API backend](../backend_clean) via chamadas HTTP. Todo o código JavaScript foi escrito em **TypeScript** e compilado antes da publicação.

### Escopo implementado

- Login: autenticação com username e senha; tokens JWT armazenados em `localStorage`.
- Cadastro: criação de conta com nome, sobrenome, matrícula, e-mail e senha.
- Dashboard: listagem e busca de projetos do usuário; aba de convites pendentes.
- Página de Projeto: detalhes do projeto, membros, envio de convites e lista de tarefas com filtros.
- Página de Tarefa: detalhes, alteração de status, atribuição de responsável e observações com polling a cada 6 segundos.
- Perfil: edição de nome, sobrenome e matrícula; troca de senha com validação da senha atual.
- Sidebar dinâmica: exibe nome do usuário, badge de convites pendentes e navegação entre páginas.
- Controle de papéis: a interface mostra ou oculta ações conforme o papel do usuário no projeto (Líder ou Membro).

---

## Instalação e Uso Local

### Pré-requisitos

- Qualquer servidor HTTP estático (eu usei o abaixo)
- A API backend rodando em `http://localhost:8000`

### Opção A: Python (sem instalação extra)

```bash
cd frontend
python -m http.server 5173
```

Acesse **http://localhost:5173**.

## Compilar o TypeScript

O código-fonte está em `src/`. Os arquivos compilados em `js/` já estão prontos para uso.

Para recompilar após alterações:

```bash
cd frontend
npm install          # instala o TypeScript (já declarado em package.json)
npx tsc              # compila seguindo o tsconfig.json
```

Os arquivos gerados em `js/` sobrescrevem os anteriores.

---

## Manual do Usuário

### Criar uma conta

1. Na página inicial, clique em **Criar conta**.
2. Preencha nome, sobrenome, username, e-mail institucional, matrícula e senha.
3. Clique em **Criar conta**. Você será redirecionado ao Dashboard.

### Fazer login

Informe seu **username** e **senha** na página inicial e clique em **Entrar**.

### Criar um projeto

1. No Dashboard, clique em **Novo Projeto**.
2. Preencha nome e descrição e clique em **Criar**.
3. Você vira o **Líder** do projeto automaticamente.

### Convidar um colega

1. Abra o projeto desejado.
2. Na seção **Membros**, clique em **Convidar**.
3. Informe o **username** do colega e confirme.
4. O colega verá o convite na aba **Convites** do Dashboard.

### Aceitar ou recusar um convite

Na aba **Convites** do Dashboard, clique em **Aceitar** ou **Recusar**.

### Criar e gerenciar tarefas (Líder)

1. Dentro do projeto, clique em **Nova Tarefa**.
2. Preencha título, descrição, responsável (opcional) e prazo (opcional) e clique em **Criar**.
3. Para editar ou excluir, abra a tarefa e use os botões correspondentes.

### Atualizar o status de uma tarefa

Abra a tarefa e altere o campo **Status**. Uma observação automática registra quem fez a mudança e quando.

### Deixar uma observação

Na página da tarefa, escreva na caixa de texto e clique em **Enviar**. As observações são atualizadas automaticamente a cada 6 segundos.

### Trocar a senha

1. Acesse **Perfil** pela sidebar.
2. Clique em **Alterar senha**.
3. Informe a senha atual, a nova senha e a confirmação e salve.

---

## O que funcionou

Login e cadastro com validação de campos. Renovação automática do token de acesso ao expirar, com redirecionamento para o login quando o refresh também expira.

Dashboard com listagem e busca de projetos, criação de projetos e aba de convites com badge de pendentes na sidebar.

Envio, aceitação e recusa de convites. Página de projeto com membros, lista de tarefas filtráveis e criação/edição/exclusão de tarefas pelo Líder.

Mudança de status de tarefas por qualquer membro. Observações com polling automático a cada 6 segundos. Controle de papéis: botões e ações visíveis conforme o papel no projeto.

Perfil com edição de dados e troca de senha. CSS responsivo com design system próprio. Todo o JavaScript foi desenvolvido em TypeScript.

---

## O que não funcionou

**Esqueci minha senha:** a recuperação de senha via e-mail não foi implementada. Usuários que não lembram a senha não conseguem redefini-la pelo site. A **troca de senha** para usuários logados está disponível e funcionando normalmente na página de Perfil.

---

> Link do site:
