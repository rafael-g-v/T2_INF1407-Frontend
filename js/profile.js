/**
 * profile.ts — Página de perfil do usuário.
 *
 * Funcionalidades:
 *  - Visualizar e editar dados do perfil (nome, sobrenome, matrícula)
 */
import { AuthAPI } from "./api.js";
import { requireAuth, loadSidebar, showAlert, setLoading } from "./auth.js";
requireAuth();
// ── Bootstrap ─────────────────────────────────────────────────────────────
(async () => {
    await loadSidebar("profile");
    await loadPerfil();
})();
// ── Carregar e renderizar perfil ──────────────────────────────────────────
async function loadPerfil() {
    try {
        const p = await AuthAPI.getPerfil();
        // Cabeçalho
        document.getElementById("profile-name").textContent = `${p.nome} ${p.sobrenome}`;
        document.getElementById("profile-username").textContent = `@${p.username}`;
        document.getElementById("profile-email").textContent = p.email;
        document.getElementById("profile-matricula").textContent = p.matricula;
        // Avatar iniciais
        const initials = (p.nome[0] ?? "").toUpperCase() + (p.sobrenome[0] ?? "").toUpperCase();
        const avatarEl = document.getElementById("profile-avatar");
        if (avatarEl)
            avatarEl.textContent = initials;
        // Preenche formulário de edição
        document.getElementById("edit-nome").value = p.nome;
        document.getElementById("edit-sobrenome").value = p.sobrenome;
        document.getElementById("edit-matricula").value = p.matricula;
    }
    catch (err) {
        showAlert("alert-profile", err.message);
    }
}
// ── Formulário de edição do perfil ────────────────────────────────────────
const formEdit = document.getElementById("form-edit-profile");
const btnSaveProfile = document.getElementById("btn-save-profile");
formEdit.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("edit-nome").value.trim();
    const sobrenome = document.getElementById("edit-sobrenome").value.trim();
    const matricula = document.getElementById("edit-matricula").value.trim();
    if (!nome || !sobrenome || !matricula) {
        showAlert("alert-profile", "Preencha todos os campos.");
        return;
    }
    setLoading(btnSaveProfile, true, "Salvar");
    try {
        const updated = await AuthAPI.updatePerfil({ nome, sobrenome, matricula });
        localStorage.removeItem("current_user"); // invalida cache
        document.getElementById("profile-name").textContent = `${updated.nome} ${updated.sobrenome}`;
        document.getElementById("profile-matricula").textContent = updated.matricula;
        const avatarEl = document.getElementById("profile-avatar");
        if (avatarEl)
            avatarEl.textContent =
                (updated.nome[0] ?? "").toUpperCase() + (updated.sobrenome[0] ?? "").toUpperCase();
        showAlert("alert-profile", "Perfil atualizado com sucesso!", "success");
    }
    catch (err) {
        showAlert("alert-profile", err.message);
    }
    finally {
        setLoading(btnSaveProfile, false, "Salvar");
    }
});
