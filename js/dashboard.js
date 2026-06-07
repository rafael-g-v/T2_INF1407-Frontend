/**
 * dashboard.ts — Painel principal: lista de projetos e convites pendentes.
 */
import { ProjetoAPI, ConviteAPI } from "./api.js";
import { requireAuth, loadSidebar, showAlert, clearAlert, openModal, closeModal, bindModalClose, setLoading, formatDate, } from "./auth.js";
requireAuth();
// ── Estado ────────────────────────────────────────────────────────────────
let projetos = [];
let convitesPendentes = [];
// ── Bootstrap ─────────────────────────────────────────────────────────────
(async () => {
    await loadSidebar("dashboard");
    // Se a URL termina com #convites, muda para a aba de convites automaticamente
    if (window.location.hash === "#convites")
        switchTab("convites");
    await Promise.all([loadProjetos(), loadConvites()]);
})();
// ── Carregamento de dados ─────────────────────────────────────────────────
async function loadProjetos() {
    const grid = document.getElementById("projects-grid");
    grid.innerHTML = `<div class="loading-center"><span class="spinner"></span> Carregando…</div>`;
    try {
        projetos = await ProjetoAPI.listar();
        renderProjetos();
    }
    catch (err) {
        grid.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
}
async function loadConvites() {
    const list = document.getElementById("invites-list");
    list.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
    try {
        const todos = await ConviteAPI.meus();
        convitesPendentes = todos.filter((c) => c.status === "P");
        renderConvites();
        // Atualiza o badge na aba
        const badge = document.getElementById("convites-badge");
        if (badge) {
            badge.textContent = String(convitesPendentes.length);
            badge.classList.toggle("hidden", convitesPendentes.length === 0);
        }
    }
    catch (err) {
        list.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
}
// ── Renderização ──────────────────────────────────────────────────────────
function renderProjetos() {
    const grid = document.getElementById("projects-grid");
    const count = document.getElementById("projects-count");
    count.textContent = String(projetos.length);
    if (!projetos.length) {
        grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">📁</div>
        <h3>Nenhum projeto ainda</h3>
        <p>Crie seu primeiro projeto ou aguarde um convite.</p>
      </div>`;
        return;
    }
    grid.innerHTML = projetos
        .map((p) => {
        const papel = p.meu_papel ?? "—";
        const badgeClass = p.meu_papel === "Líder" ? "badge-gold" : "badge-blue";
        return `
        <a href="/project.html?id=${p.id}" class="project-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:8px">
            <div class="project-card-name">${escHtml(p.nome)}</div>
            <span class="badge ${badgeClass}">${papel}</span>
          </div>
          <p class="project-card-desc">${escHtml(p.descricao)}</p>
          <div class="project-card-meta">
            <span>👥 ${p.total_membros}</span>
            <span>✅ ${p.total_tarefas}</span>
            <span>${formatDate(p.criado_em)}</span>
          </div>
        </a>`;
    })
        .join("");
}
function renderConvites() {
    const list = document.getElementById("invites-list");
    if (!convitesPendentes.length) {
        list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📬</div>
        <h3>Nenhum convite pendente</h3>
        <p>Quando alguém te convidar para um projeto, aparecerá aqui.</p>
      </div>`;
        return;
    }
    list.innerHTML = convitesPendentes
        .map((c) => `
      <div class="invite-card">
        <div class="invite-info">
          <div class="invite-project">${escHtml(c.projeto.nome)}</div>
          <div class="invite-by">Convidado por <strong>${c.convidado_por.username}</strong> · ${formatDate(c.data_envio)}</div>
        </div>
        <div class="invite-actions">
          <button class="btn btn-sm btn-primary btn-aceitar" data-id="${c.id}">Aceitar</button>
          <button class="btn btn-sm btn-danger btn-recusar" data-id="${c.id}">Recusar</button>
        </div>
      </div>`)
        .join("");
    // Bind aceitar / recusar
    list.querySelectorAll(".btn-aceitar").forEach((btn) => {
        btn.addEventListener("click", () => responderConvite(Number(btn.dataset["id"]), "aceitar", btn));
    });
    list.querySelectorAll(".btn-recusar").forEach((btn) => {
        btn.addEventListener("click", () => responderConvite(Number(btn.dataset["id"]), "recusar", btn));
    });
}
async function responderConvite(id, acao, btn) {
    const label = btn.textContent ?? acao;
    setLoading(btn, true, label);
    try {
        if (acao === "aceitar")
            await ConviteAPI.aceitar(id);
        else
            await ConviteAPI.recusar(id);
        await Promise.all([loadProjetos(), loadConvites()]);
    }
    catch (err) {
        alert(err.message);
    }
    finally {
        setLoading(btn, false, label);
    }
}
// ── Tabs ──────────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll(".tab").forEach((t) => {
        t.classList.toggle("active", t.dataset["tab"] === tab);
    });
    document.querySelectorAll(".tab-content").forEach((c) => {
        c.classList.toggle("active", c.dataset["content"] === tab);
    });
}
document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => switchTab(t.dataset["tab"]));
});
// ── Modal criar projeto ───────────────────────────────────────────────────
const modalId = "modal-new-project";
const btnNew = document.getElementById("btn-new-project");
const formNew = document.getElementById("form-new-project");
const btnSave = document.getElementById("btn-save-project");
btnNew?.addEventListener("click", () => {
    clearAlert("alert-new-project");
    formNew.reset();
    openModal(modalId);
});
document.getElementById("btn-close-modal")?.addEventListener("click", () => closeModal(modalId));
bindModalClose(modalId);
formNew.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("new-nome").value.trim();
    const descricao = document.getElementById("new-descricao").value.trim();
    if (!nome || !descricao) {
        showAlert("alert-new-project", "Preencha nome e descrição.");
        return;
    }
    setLoading(btnSave, true, "Criar");
    try {
        const novo = await ProjetoAPI.criar(nome, descricao);
        closeModal(modalId);
        window.location.href = `/project.html?id=${novo.id}`;
    }
    catch (err) {
        showAlert("alert-new-project", err.message);
    }
    finally {
        setLoading(btnSave, false, "Criar");
    }
});
// ── Pesquisa local ────────────────────────────────────────────────────────
document.getElementById("search-projects")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".project-card").forEach((card) => {
        const text = card.textContent?.toLowerCase() ?? "";
        card.style.display = text.includes(q) ? "" : "none";
    });
});
// ── Utilitário ────────────────────────────────────────────────────────────
function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
