import { ProjetoAPI, ConviteAPI } from "./api.js";
import type { Projeto, Convite } from "./api.js";
import {
  requireAuth, loadSidebar, setSidebarActive, showAlert, clearAlert,
  openModal, closeModal, bindModalClose,
  setLoading, formatDate,
} from "./auth.js";

requireAuth();

let projetos: Projeto[] = [];
let convitesPendentes: Convite[] = [];
let currentTab: "projetos" | "convites" = "projetos";
let pollingInterval: ReturnType<typeof setInterval> | null = null;

(async () => {
  const startTab = window.location.hash === "#convites" ? "convites" : "projetos";
  currentTab = startTab;

  await loadSidebar(startTab);

  if (startTab === "convites") switchTab("convites", false);

  await Promise.all([loadProjetos(), loadConvites()]);
  startPolling();
})();

// ── Polling ───────────────────────────────────────────────────────────────

function startPolling(): void {
  if (pollingInterval) clearInterval(pollingInterval);
  let tick = 0;
  pollingInterval = setInterval(async () => {
    tick++;
    await loadConvites(true);
    if (tick % 2 === 0) await loadProjetos(true);
  }, 5000);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (pollingInterval) clearInterval(pollingInterval); }
  else startPolling();
});

// ── Carregamento de dados ─────────────────────────────────────────────────

async function loadProjetos(silent = false): Promise<void> {
  const grid = document.getElementById("projects-grid")!;
  if (!silent) {
    grid.innerHTML = `<div class="loading-center"><span class="spinner"></span> Carregando…</div>`;
  }
  try {
    projetos = await ProjetoAPI.listar();
    renderProjetos();
  } catch (err) {
    if (!silent) {
      grid.innerHTML = `<div class="alert alert-error">${(err as Error).message}</div>`;
    }
  }
}

async function loadConvites(silent = false): Promise<void> {
  const list = document.getElementById("invites-list")!;
  if (!silent) {
    list.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
  }
  try {
    const todos = await ConviteAPI.meus();
    const novos = todos.filter((c) => c.status === "P");

    if (silent && novos.length > convitesPendentes.length) {
      showToast(`Você recebeu ${novos.length - convitesPendentes.length} novo(s) convite(s)!`);
    }

    convitesPendentes = novos;
    if (!silent || currentTab === "convites") renderConvites();

    const badge = document.getElementById("convites-badge");
    if (badge) {
      badge.textContent = String(convitesPendentes.length);
      badge.classList.toggle("hidden", convitesPendentes.length === 0);
    }
  } catch (err) {
    if (!silent) {
      list.innerHTML = `<div class="alert alert-error">${(err as Error).message}</div>`;
    }
  }
}

// ── Renderização ──────────────────────────────────────────────────────────

function renderProjetos(): void {
  const grid = document.getElementById("projects-grid")!;
  const count = document.getElementById("projects-count")!;
  count.textContent = String(projetos.length);

  if (!projetos.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
        </div>
        <h3>Nenhum projeto ainda</h3>
        <p>Crie seu primeiro projeto ou aguarde um convite.</p>
      </div>`;
    return;
  }

  grid.innerHTML = projetos.map((p) => {
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
          <span style="display:flex;align-items:center;gap:4px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            ${p.total_membros}
          </span>
          <span style="display:flex;align-items:center;gap:4px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            ${p.total_tarefas}
          </span>
          <span>${formatDate(p.criado_em)}</span>
        </div>
      </a>`;
  }).join("");
}

function renderConvites(): void {
  const list = document.getElementById("invites-list")!;

  if (!convitesPendentes.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        </div>
        <h3>Nenhum convite pendente</h3>
        <p>Quando alguém te convidar para um projeto, aparecerá aqui.</p>
      </div>`;
    return;
  }

  list.innerHTML = convitesPendentes.map((c) => `
    <div class="invite-card">
      <div class="invite-info">
        <div class="invite-project">${escHtml(c.projeto.nome)}</div>
        <div class="invite-by">Convidado por <strong>${c.convidado_por.username}</strong> · ${formatDate(c.data_envio)}</div>
      </div>
      <div class="invite-actions">
        <button class="btn btn-sm btn-primary btn-aceitar" data-id="${c.id}">Aceitar</button>
        <button class="btn btn-sm btn-danger btn-recusar"  data-id="${c.id}">Recusar</button>
      </div>
    </div>`).join("");

  list.querySelectorAll<HTMLButtonElement>(".btn-aceitar").forEach((btn) => {
    btn.addEventListener("click", () => responderConvite(Number(btn.dataset["id"]), "aceitar", btn));
  });
  list.querySelectorAll<HTMLButtonElement>(".btn-recusar").forEach((btn) => {
    btn.addEventListener("click", () => responderConvite(Number(btn.dataset["id"]), "recusar", btn));
  });
}

async function responderConvite(id: number, acao: "aceitar" | "recusar", btn: HTMLButtonElement): Promise<void> {
  const label = btn.textContent ?? acao;
  setLoading(btn, true, label);
  try {
    if (acao === "aceitar") await ConviteAPI.aceitar(id);
    else await ConviteAPI.recusar(id);
    await Promise.all([loadProjetos(), loadConvites()]);
  } catch (err) {
    alert((err as Error).message);
  } finally {
    setLoading(btn, false, label);
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────

// second param "updateSidebar" evita chamar setSidebarActive na inicialização
// (o loadSidebar já passou o activePage correto)
function switchTab(tab: "projetos" | "convites", updateSidebar = true): void {
  currentTab = tab;
  document.querySelectorAll<HTMLElement>(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset["tab"] === tab);
  });
  document.querySelectorAll<HTMLElement>(".tab-content").forEach((c) => {
    c.classList.toggle("active", c.dataset["content"] === tab);
  });
  if (updateSidebar) {
    // "projetos" → sidebar marca "dashboard"; "convites" → marca "convites"
    setSidebarActive(tab === "projetos" ? "dashboard" : "convites");
  }
}

document.querySelectorAll<HTMLElement>(".tab").forEach((t) => {
  t.addEventListener("click", () => switchTab(t.dataset["tab"] as "projetos" | "convites"));
});

// ── Modal novo projeto ────────────────────────────────────────────────────

const modalId = "modal-new-project";
const btnNew  = document.getElementById("btn-new-project");
const formNew = document.getElementById("form-new-project") as HTMLFormElement;
const btnSave = document.getElementById("btn-save-project") as HTMLButtonElement;

btnNew?.addEventListener("click", () => { clearAlert("alert-new-project"); formNew.reset(); openModal(modalId); });
document.getElementById("btn-close-modal")?.addEventListener("click", () => closeModal(modalId));
bindModalClose(modalId);

formNew.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome      = (document.getElementById("new-nome")      as HTMLInputElement).value.trim();
  const descricao = (document.getElementById("new-descricao") as HTMLTextAreaElement).value.trim();
  if (!nome || !descricao) { showAlert("alert-new-project", "Preencha nome e descrição."); return; }

  setLoading(btnSave, true, "Criar");
  try {
    const novo = await ProjetoAPI.criar(nome, descricao);
    closeModal(modalId);
    window.location.href = `/project.html?id=${novo.id}`;
  } catch (err) {
    showAlert("alert-new-project", (err as Error).message);
  } finally {
    setLoading(btnSave, false, "Criar");
  }
});

// ── Pesquisa local ────────────────────────────────────────────────────────

document.getElementById("search-projects")?.addEventListener("input", (e) => {
  const q = (e.target as HTMLInputElement).value.toLowerCase();
  document.querySelectorAll<HTMLElement>(".project-card").forEach((card) => {
    card.style.display = (card.textContent?.toLowerCase() ?? "").includes(q) ? "" : "none";
  });
});

// ── Toast ─────────────────────────────────────────────────────────────────

function showToast(msg: string): void {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Utilitário ────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}