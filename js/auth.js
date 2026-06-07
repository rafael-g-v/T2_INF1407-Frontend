/**
 * auth.ts — Utilitários de autenticação e UI compartilhada.
 *
 * Exports:
 *  - requireAuth()       redireciona para login se não autenticado
 *  - requireGuest()      redireciona para dashboard se já autenticado
 *  - loadSidebar()       injeta a sidebar e carrega dados do usuário
 *  - showAlert()         exibe mensagem de feedback
 *  - openModal() / closeModal()
 *  - formatDate()
 *  - getQueryParam()
 */
import { TokenStore, AuthAPI, ConviteAPI } from "./api.js";
// ── Guarda de rota ────────────────────────────────────────────────────────
/** Redireciona para o login se não houver token salvo. */
export function requireAuth() {
    if (!TokenStore.isLogged()) {
        window.location.href = "index.html";
    }
}
/** Redireciona para o dashboard se já estiver autenticado. */
export function requireGuest() {
    if (TokenStore.isLogged()) {
        window.location.href = "dashboard.html";
    }
}
// ── URL helpers ───────────────────────────────────────────────────────────
export function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}
// ── Formatação de data ────────────────────────────────────────────────────
export function formatDate(iso) {
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
export function formatDateTime(iso) {
    return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
export function relativeTime(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1)
        return "agora mesmo";
    if (mins < 60)
        return `há ${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `há ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `há ${days}d`;
}
// ── Alertas inline ────────────────────────────────────────────────────────
/**
 * Insere ou atualiza um elemento de alerta dentro de um container.
 * @param containerId ID do elemento que receberá o alerta
 * @param msg         Mensagem a exibir
 * @param type        Tipo visual: 'error' | 'success' | 'info' | 'warning'
 */
export function showAlert(containerId, msg, type = "error") {
    const container = document.getElementById(containerId);
    if (!container)
        return;
    container.innerHTML = `
    <div class="alert alert-${type}" role="alert">
      ${msg}
    </div>`;
}
export function clearAlert(containerId) {
    const container = document.getElementById(containerId);
    if (container)
        container.innerHTML = "";
}
// ── Loading state de botão ────────────────────────────────────────────────
export function setLoading(btn, loading, label = "Salvar") {
    if (loading) {
        btn.disabled = true;
        btn.dataset["original"] = btn.innerHTML;
        btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span>`;
    }
    else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset["original"] ?? label;
    }
}
// ── Modal helper ──────────────────────────────────────────────────────────
export function openModal(id) {
    const el = document.getElementById(id);
    if (el)
        el.classList.remove("hidden");
}
export function closeModal(id) {
    const el = document.getElementById(id);
    if (el)
        el.classList.add("hidden");
}
/** Fecha modal ao clicar no overlay (fora do .modal). */
export function bindModalClose(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (!overlay)
        return;
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay)
            closeModal(overlayId);
    });
}
// ── Iniciais do nome ──────────────────────────────────────────────────────
export function iniciais(nome) {
    return nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
}
// ── Sidebar / Layout compartilhado ───────────────────────────────────────
/**
 * Carrega a sidebar a partir do servidor e preenche dados do usuário.
 * Espera que a página tenha um elemento com id="sidebar-root".
 */
export async function loadSidebar(activePage) {
    const root = document.getElementById("sidebar-root");
    if (!root)
        return null;
    // Conta convites pendentes para o badge
    let pendingCount = 0;
    try {
        const invites = await ConviteAPI.meus();
        pendingCount = invites.filter((c) => c.status === "P").length;
    }
    catch {
        /* silencioso */
    }
    let perfil = null;
    try {
        perfil = await AuthAPI.getPerfil();
        localStorage.setItem("current_user", JSON.stringify(perfil));
    }
    catch {
        const cached = localStorage.getItem("current_user");
        if (cached)
            perfil = JSON.parse(cached);
    }
    const nomeCompleto = perfil ? `${perfil.nome} ${perfil.sobrenome}` : "Usuário";
    const initial = perfil ? iniciais(nomeCompleto) : "U";
    const matricula = perfil?.matricula ?? "";
    const navLinks = [
        {
            href: "/dashboard.html", key: "dashboard",
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
            label: "Projetos",
        },
        {
            href: "/dashboard.html#convites", key: "convites",
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`,
            label: "Convites",
            badge: pendingCount > 0 ? pendingCount : undefined,
        },
        {
            href: "/profile.html", key: "profile",
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
            label: "Perfil",
        },
    ];
    root.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-mark">
        <div class="logo-icon">A</div>
        <div>
          <div class="logo-text">Acadêmico</div>
          <span class="logo-sub">Projetos &amp; Equipes</span>
        </div>
      </div>
    </div>

    <div class="sidebar-user">
      <div class="user-info">
        <div class="user-avatar">${initial}</div>
        <div>
          <div class="user-name">${nomeCompleto}</div>
          <div class="user-role font-mono">${matricula}</div>
        </div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-label">Menu</div>
        ${navLinks
        .map((l) => `
          <a href="${l.href}" class="nav-link ${l.key === activePage ? "active" : ""}">
            ${l.icon}
            <span>${l.label}</span>
            ${l.badge ? `<span class="badge badge-gold" style="margin-left:auto">${l.badge}</span>` : ""}
          </a>`)
        .join("")}
      </div>
    </nav>

    <div class="sidebar-footer">
      <button id="btn-logout" class="nav-link btn-ghost" style="width:100%">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        Sair
      </button>
    </div>`;
    document.getElementById("btn-logout")?.addEventListener("click", async () => {
        await AuthAPI.logout();
        window.location.href = "index.html";
    });
    return perfil;
}
