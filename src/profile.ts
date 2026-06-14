/**
 * profile.ts — Página de perfil do usuário.
 *
 * Funcionalidades:
 *  - Visualizar e editar dados do perfil (nome, sobrenome, matrícula).
 *  - Trocar a senha com confirmação da senha atual.
 */

import { AuthAPI, TokenStore } from "./api.js";
import { requireAuth, loadSidebar, showAlert, setLoading } from "./auth.js";

requireAuth();

// ── Bootstrap ─────────────────────────────────────────────────────────────

(async () => {
  await loadSidebar("profile");
  await loadPerfil();
})();

// ── Carregar e renderizar perfil ──────────────────────────────────────────

async function loadPerfil(): Promise<void> {
  try {
    const p = await AuthAPI.getPerfil();

    // Cabeçalho
    document.getElementById("profile-name")!.textContent = `${p.nome} ${p.sobrenome}`;
    document.getElementById("profile-username")!.textContent = `@${p.username}`;
    document.getElementById("profile-email")!.textContent = p.email;
    document.getElementById("profile-matricula")!.textContent = p.matricula;

    // Avatar iniciais
    const initials = (p.nome[0] ?? "").toUpperCase() + (p.sobrenome[0] ?? "").toUpperCase();
    const avatarEl = document.getElementById("profile-avatar");
    if (avatarEl) avatarEl.textContent = initials;

    // Preenche formulário de edição
    (document.getElementById("edit-nome")      as HTMLInputElement).value = p.nome;
    (document.getElementById("edit-sobrenome") as HTMLInputElement).value = p.sobrenome;
    (document.getElementById("edit-matricula") as HTMLInputElement).value = p.matricula;
  } catch (err) {
    showAlert("alert-profile", (err as Error).message);
  }
}

// ── Formulário de edição do perfil ────────────────────────────────────────

const formEdit = document.getElementById("form-edit-profile") as HTMLFormElement;
const btnSaveProfile = document.getElementById("btn-save-profile") as HTMLButtonElement;

formEdit.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome      = (document.getElementById("edit-nome")      as HTMLInputElement).value.trim();
  const sobrenome = (document.getElementById("edit-sobrenome") as HTMLInputElement).value.trim();
  const matricula = (document.getElementById("edit-matricula") as HTMLInputElement).value.trim();

  if (!nome || !sobrenome || !matricula) {
    showAlert("alert-profile", "Preencha todos os campos.");
    return;
  }

  setLoading(btnSaveProfile, true, "Salvar");
  try {
    const updated = await AuthAPI.updatePerfil({ nome, sobrenome, matricula });
    localStorage.removeItem("current_user"); // invalida cache
    document.getElementById("profile-name")!.textContent = `${updated.nome} ${updated.sobrenome}`;
    document.getElementById("profile-matricula")!.textContent = updated.matricula;
    const avatarEl = document.getElementById("profile-avatar");
    if (avatarEl)
      avatarEl.textContent =
        (updated.nome[0] ?? "").toUpperCase() + (updated.sobrenome[0] ?? "").toUpperCase();
    showAlert("alert-profile", "Perfil atualizado com sucesso!", "success");
  } catch (err) {
    showAlert("alert-profile", (err as Error).message);
  } finally {
    setLoading(btnSaveProfile, false, "Salvar");
  }
});

// ── Formulário de troca de senha ──────────────────────────────────────────

const formSenha = document.getElementById("form-change-password") as HTMLFormElement;
const btnSaveSenha = document.getElementById("btn-save-senha") as HTMLButtonElement;

formSenha.addEventListener("submit", async (e) => {
  e.preventDefault();

  const senhaAtual = (document.getElementById("senha-atual")  as HTMLInputElement).value;
  const novaSenha  = (document.getElementById("nova-senha")   as HTMLInputElement).value;
  const novaSenha2 = (document.getElementById("nova-senha2")  as HTMLInputElement).value;

  // Validações no cliente para evitar chamada desnecessária
  if (!senhaAtual || !novaSenha || !novaSenha2) {
    showAlert("alert-senha", "Preencha todos os campos de senha.");
    return;
  }
  if (novaSenha !== novaSenha2) {
    showAlert("alert-senha", "As novas senhas não coincidem.");
    return;
  }
  if (novaSenha.length < 8) {
    showAlert("alert-senha", "A nova senha deve ter pelo menos 8 caracteres.");
    return;
  }

  setLoading(btnSaveSenha, true, "Alterar senha");
  try {
    const result = await AuthAPI.trocarSenha(senhaAtual, novaSenha, novaSenha2);

    // Atualiza os tokens na sessão (o backend emite um novo par após trocar a senha)
    if (result.tokens) {
      TokenStore.set(result.tokens.access, result.tokens.refresh);
    }

    // Limpa os campos do formulário
    formSenha.reset();

    showAlert("alert-senha", "Senha alterada com sucesso!", "success");
  } catch (err) {
    showAlert("alert-senha", (err as Error).message);
  } finally {
    setLoading(btnSaveSenha, false, "Alterar senha");
  }
});