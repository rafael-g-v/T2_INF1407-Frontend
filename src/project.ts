import { ProjetoAPI, TarefaAPI, MembroAPI, ConviteAPI, ObsAPI } from "./api.js";
import type { Projeto, Tarefa, MembroProjeto, Convite } from "./api.js";
import {
  requireAuth, loadSidebar, showAlert, clearAlert,
  openModal, closeModal, bindModalClose,
  setLoading, formatDate, getQueryParam, iniciais,
} from "./auth.js";

requireAuth();

const projetoId = Number(getQueryParam("id"));
if (!projetoId) window.location.href = "dashboard.html";

let projeto: Projeto | null = null;
let tarefas: Tarefa[] = [];
let membros: MembroProjeto[] = [];
let convites: Convite[] = [];
let isLider = false;
let currentUsername = "";
let currentNomeCompleto = "";
let pollingInterval: ReturnType<typeof setInterval> | null = null;

(async () => {
  const perfil = await loadSidebar("dashboard");
  currentUsername = perfil?.username ?? "";
  currentNomeCompleto = perfil ? `${perfil.nome} ${perfil.sobrenome}` : currentUsername;

  try {
    projeto = await ProjetoAPI.detalhar(projetoId);
    isLider = projeto.meu_papel === "Líder";
    renderHeader();
    await Promise.all([loadTarefas(), loadMembros()]);
    if (isLider) await loadConvites();
    setupUI();
    startPolling();
  } catch (err) {
    const msg = (err as Error).message;
    const foiRemovido = msg.includes("No Projeto") || msg.includes("404") || msg.includes("matches");
    document.getElementById("project-body")!.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;gap:16px">
        <div style="font-size:3rem">🚫</div>
        <h2 style="color:var(--text)">Acesso negado</h2>
        <p style="color:var(--text-3);max-width:380px">
          ${foiRemovido
            ? "Você não tem mais acesso a este projeto. O líder pode ter removido você da equipe."
            : escHtml(msg)}
        </p>
        <a href="dashboard.html" class="btn btn-primary" style="margin-top:8px">Voltar aos projetos</a>
      </div>`;
  }
})();

// ── Polling ───────────────────────────────────────────────────────────────

function startPolling(): void {
  if (pollingInterval) clearInterval(pollingInterval);
  let tick = 0;
  pollingInterval = setInterval(async () => {
    tick++;
    await loadTarefas(true);
    if (isLider && tick % 2 === 0) await loadConvites(true);
  }, 8000);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (pollingInterval) clearInterval(pollingInterval); }
  else startPolling();
});

// ── Header ────────────────────────────────────────────────────────────────

function renderHeader(): void {
  if (!projeto) return;
  const badgeClass = isLider ? "badge-gold" : "badge-blue";
  document.getElementById("project-name")!.textContent = projeto.nome;
  document.getElementById("project-desc")!.textContent = projeto.descricao;
  document.getElementById("project-badge")!.innerHTML =
    `<span class="badge ${badgeClass}">${projeto.meu_papel ?? "—"}</span>`;
  document.getElementById("project-meta")!.innerHTML =
    `<span class="text-xs text-muted font-mono">Criado por ${projeto.criado_por.username} · ${formatDate(projeto.criado_em)}</span>`;

  const actionsEl = document.getElementById("project-actions")!;
  if (isLider) {
    actionsEl.innerHTML = `
      <button id="btn-edit-project" class="btn btn-secondary btn-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar
      </button>
      <button id="btn-delete-project" class="btn btn-danger btn-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        Excluir
      </button>`;
    document.getElementById("btn-edit-project")?.addEventListener("click", openEditProject);
    document.getElementById("btn-delete-project")?.addEventListener("click", openDeleteProject);
  }

  const tabConvites = document.getElementById("tab-convites");
  if (tabConvites) tabConvites.classList.toggle("hidden", !isLider);
}

// ── Tarefas ───────────────────────────────────────────────────────────────

async function loadTarefas(silent = false): Promise<void> {
  const el = document.getElementById("tarefas-list")!;
  if (!silent) el.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
  const novas = await TarefaAPI.listar(projetoId);
  if (silent && JSON.stringify(novas) === JSON.stringify(tarefas)) return;
  tarefas = novas;
  renderTarefas();
}

function diasAtraso(prazo: string): number {
  return Math.floor((Date.now() - new Date(prazo).getTime()) / 86400000);
}

function renderTarefas(): void {
  const el = document.getElementById("tarefas-list")!;
  document.getElementById("tarefas-count")!.textContent = String(tarefas.length);
  updateResponsavelSelect();

  const groups: Record<string, Tarefa[]> = { P: [], E: [], C: [] };
  tarefas.forEach((t) => groups[t.status].push(t));

  const groupConfig = [
    { key: "E", label: "Em andamento", dot: "var(--blue)",   emptyMsg: "Nenhuma tarefa em andamento" },
    { key: "P", label: "Pendente",     dot: "var(--text-4)", emptyMsg: "Nenhuma tarefa pendente" },
    { key: "C", label: "Concluída",    dot: "var(--green)",  emptyMsg: "Nenhuma tarefa concluída" },
  ];

  el.innerHTML = groupConfig.map(({ key, label, dot, emptyMsg }) => {
    const list = groups[key];
    const content = list.length
      ? list.map(renderTarefaItem).join("")
      : `<div class="task-group-empty">${emptyMsg}</div>`;
    return `
      <div class="task-group">
        <div class="task-group-header">
          <span class="task-group-dot" style="background:${dot}"></span>
          <span class="task-group-label">${label}</span>
          <span class="task-group-count">${list.length}</span>
        </div>
        <div class="task-group-body">${content}</div>
      </div>`;
  }).join("");

  el.querySelectorAll<HTMLElement>(".task-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      window.location.href = `/task.html?projeto=${projetoId}&id=${item.dataset["id"]}`;
    });
  });

  // Bind de troca rápida de status diretamente da lista
  el.querySelectorAll<HTMLSelectElement>(".task-status-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      e.stopPropagation();
      const tarefaId = Number(sel.dataset["id"]);
      const novoStatus = sel.value as "P" | "E" | "C";
      quickStatusChange(tarefaId, novoStatus, sel);
    });
  });
}

function renderTarefaItem(t: Tarefa): string {
  const concluida = t.status === "C";
  const atraso    = !concluida && t.prazo ? diasAtraso(t.prazo) : 0;
  const atrasada  = t.status === "P" && atraso > 0;

  const prazoHtml = t.prazo
    ? `<span class="task-chip ${atrasada ? "task-chip-red" : ""}">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
         ${formatDate(t.prazo)}${atrasada ? ` · <strong>${atraso}d atraso</strong>` : ""}
       </span>`
    : "";

  const respHtml = t.responsavel
    ? `<span class="task-chip">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
         ${escHtml(t.responsavel.username)}
       </span>`
    : "";

  const obsHtml = `<span class="task-chip">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    ${t.total_observacoes}
  </span>`;

  const statusSelectHtml = `
    <select class="task-status-select" data-id="${t.id}" title="Mudar status">
      <option value="P" ${t.status === "P" ? "selected" : ""}>Pendente</option>
      <option value="E" ${t.status === "E" ? "selected" : ""}>Em andamento</option>
      <option value="C" ${t.status === "C" ? "selected" : ""}>Concluída</option>
    </select>`;

  const editBtn = isLider
    ? `<button class="btn btn-icon btn-ghost btn-sm btn-edit-tarefa" data-id="${t.id}" title="Editar">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
       </button>
       <button class="btn btn-icon btn-ghost btn-sm btn-del-tarefa" data-id="${t.id}" title="Excluir">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
       </button>`
    : "";

  return `
    <div class="task-item ${concluida ? "task-done" : ""} ${atrasada ? "task-overdue" : ""}" data-id="${t.id}">
      <div class="task-item-left">
        <div class="task-title ${concluida ? "task-title-done" : ""}">${escHtml(t.titulo)}</div>
        <div class="task-chips">${prazoHtml}${respHtml}${obsHtml}</div>
      </div>
      <div class="task-item-right">
        ${statusSelectHtml}
        ${editBtn}
      </div>
    </div>`;
}

async function quickStatusChange(tarefaId: number, novoStatus: "P" | "E" | "C", sel: HTMLSelectElement): Promise<void> {
  const tarefa = tarefas.find((t) => t.id === tarefaId);
  if (!tarefa) return;

  const statusLabels: Record<string, string> = { P: "Pendente", E: "Em andamento", C: "Concluída" };
  const papel = isLider ? "Líder" : "Membro";
  const obsTexto = `Status alterado de "${statusLabels[tarefa.status]}" para "${statusLabels[novoStatus]}" por ${currentNomeCompleto} (${papel}).`;

  sel.disabled = true;
  try {
    await TarefaAPI.atualizar(projetoId, tarefaId, { status: novoStatus });
    await ObsAPI.criar(projetoId, tarefaId, obsTexto);
    await loadTarefas(true);
    // força re-render para refletir novo status
    tarefas = await TarefaAPI.listar(projetoId);
    renderTarefas();
  } catch (err) {
    alert((err as Error).message);
    sel.value = tarefa.status;
  } finally {
    sel.disabled = false;
  }
}

// ── Membros ───────────────────────────────────────────────────────────────

async function loadMembros(): Promise<void> {
  const el = document.getElementById("membros-list")!;
  el.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
  membros = await MembroAPI.listar(projetoId);
  renderMembros();
}

function renderMembros(): void {
  const el = document.getElementById("membros-list")!;
  document.getElementById("membros-count")!.textContent = String(membros.length);
  if (!membros.length) { el.innerHTML = `<div class="empty-state"><h3>Nenhum membro</h3></div>`; return; }

  el.innerHTML = membros.map((m) => {
    const isMe = m.usuario.username === currentUsername;
    const canRemove = isLider && !isMe && m.papel !== "L";
    const removeBtn = canRemove
      ? `<button class="btn btn-sm btn-danger btn-remove-member" data-id="${m.id}" data-name="${m.usuario.username}">Remover</button>`
      : "";
    const badgeClass = m.papel === "L" ? "badge-gold" : "badge-blue";
    return `
      <div class="member-row">
        <div class="member-info">
          <div class="member-avatar">${iniciais(m.usuario.nome_completo)}</div>
          <div>
            <div class="member-name">${escHtml(m.usuario.nome_completo)}</div>
            <div class="member-username">@${m.usuario.username}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="badge ${badgeClass}">${m.papel_display}</span>
          ${removeBtn}
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll<HTMLButtonElement>(".btn-remove-member").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm(`Remover @${btn.dataset["name"]} do projeto?`)) removeMembro(Number(btn.dataset["id"]), btn);
    });
  });
}

async function removeMembro(id: number, btn: HTMLButtonElement): Promise<void> {
  setLoading(btn, true, "Remover");
  try {
    await MembroAPI.remover(projetoId, id);
    await loadMembros();
    updateResponsavelSelect();
  } catch (err) {
    alert((err as Error).message);
  } finally {
    setLoading(btn, false, "Remover");
  }
}

// ── Convites ──────────────────────────────────────────────────────────────

async function loadConvites(silent = false): Promise<void> {
  const el = document.getElementById("convites-list");
  if (!el) return;
  if (!silent) el.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
  const novos = await ConviteAPI.doprojeto(projetoId);
  if (silent && JSON.stringify(novos) === JSON.stringify(convites)) return;
  convites = novos;
  renderConvites();
}

function renderConvites(): void {
  const el = document.getElementById("convites-list");
  if (!el) return;
  document.getElementById("convites-count")!.textContent =
    String(convites.filter((c) => c.status === "P").length);

  if (!convites.length) {
    el.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum convite enviado</h3>
        <p>Convide membros usando o formulário acima.</p>
      </div>`;
    return;
  }

  const statusColor: Record<string, string> = { P: "badge-orange", A: "badge-green", R: "badge-red" };
  el.innerHTML = convites.map((c) => `
    <div class="member-row">
      <div class="member-info">
        <div class="member-avatar">${iniciais(c.convidado.nome_completo)}</div>
        <div>
          <div class="member-name">${escHtml(c.convidado.nome_completo)}</div>
          <div class="member-username">@${c.convidado.username}</div>
        </div>
      </div>
      <span class="badge ${statusColor[c.status] ?? "badge-gray"}">${c.status_display}</span>
    </div>`).join("");
}

// ── Setup UI ──────────────────────────────────────────────────────────────

function setupUI(): void {
  const btnNewTask = document.getElementById("btn-new-task");
  if (btnNewTask) {
    btnNewTask.classList.toggle("hidden", !isLider);
    btnNewTask.addEventListener("click", () => {
      resetTarefaModal();
      document.getElementById("tarefa-modal-title")!.textContent = "Nova Tarefa";
      openModal("modal-tarefa");
    });
  }

  const formTarefa = document.getElementById("form-tarefa") as HTMLFormElement;
  const btnSaveTarefa = document.getElementById("btn-save-tarefa") as HTMLButtonElement;
  formTarefa.addEventListener("submit", (e) => { e.preventDefault(); saveTarefa(btnSaveTarefa); });
  document.getElementById("btn-close-tarefa")?.addEventListener("click", () => closeModal("modal-tarefa"));
  bindModalClose("modal-tarefa");

  document.getElementById("tarefas-list")?.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("select")) return;
    const editBtn = target.closest<HTMLButtonElement>(".btn-edit-tarefa");
    const delBtn  = target.closest<HTMLButtonElement>(".btn-del-tarefa");
    if (editBtn) { e.stopPropagation(); openEditTarefa(Number(editBtn.dataset["id"])); }
    if (delBtn)  { e.stopPropagation(); confirmDeleteTarefa(Number(delBtn.dataset["id"])); }
  });

  const formEdit = document.getElementById("form-edit-project") as HTMLFormElement;
  const btnSaveEdit = document.getElementById("btn-save-edit") as HTMLButtonElement;
  formEdit?.addEventListener("submit", (e) => { e.preventDefault(); saveEditProject(btnSaveEdit); });
  document.getElementById("btn-close-edit")?.addEventListener("click", () => closeModal("modal-edit-project"));
  bindModalClose("modal-edit-project");

  document.getElementById("btn-confirm-delete-project")?.addEventListener("click", executeDeleteProject);
  bindModalClose("modal-delete-project");

  const formInvite = document.getElementById("form-invite") as HTMLFormElement;
  const btnInvite  = document.getElementById("btn-send-invite") as HTMLButtonElement;
  formInvite?.addEventListener("submit", (e) => { e.preventDefault(); sendInvite(btnInvite); });
}

// ── Tarefa CRUD ───────────────────────────────────────────────────────────

let editingTarefaId: number | null = null;

function resetTarefaModal(): void {
  editingTarefaId = null;
  (document.getElementById("form-tarefa") as HTMLFormElement).reset();
  clearAlert("alert-tarefa");
}

function updateResponsavelSelect(): void {
  const sel = document.getElementById("tarefa-responsavel") as HTMLSelectElement;
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = `<option value="">— Sem responsável —</option>` +
    membros.map((m) => `<option value="${m.usuario.id}">${escHtml(m.usuario.nome_completo)} (@${m.usuario.username})</option>`).join("");
  sel.value = prev;
}

function openEditTarefa(id: number): void {
  const t = tarefas.find((x) => x.id === id);
  if (!t) return;
  editingTarefaId = id;
  (document.getElementById("tarefa-titulo")      as HTMLInputElement).value    = t.titulo;
  (document.getElementById("tarefa-descricao")   as HTMLTextAreaElement).value = t.descricao;
  (document.getElementById("tarefa-status")      as HTMLSelectElement).value   = t.status;
  (document.getElementById("tarefa-prazo")       as HTMLInputElement).value    = t.prazo ?? "";
  (document.getElementById("tarefa-responsavel") as HTMLSelectElement).value   = String(t.responsavel?.id ?? "");
  document.getElementById("tarefa-modal-title")!.textContent = "Editar Tarefa";
  clearAlert("alert-tarefa");
  openModal("modal-tarefa");
}

async function saveTarefa(btn: HTMLButtonElement): Promise<void> {
  const titulo    = (document.getElementById("tarefa-titulo")      as HTMLInputElement).value.trim();
  const descricao = (document.getElementById("tarefa-descricao")   as HTMLTextAreaElement).value.trim();
  const status    = (document.getElementById("tarefa-status")      as HTMLSelectElement).value as "P" | "E" | "C";
  const prazo     = (document.getElementById("tarefa-prazo")       as HTMLInputElement).value || null;
  const respIdStr = (document.getElementById("tarefa-responsavel") as HTMLSelectElement).value;
  const responsavel_id = respIdStr ? Number(respIdStr) : null;

  if (!titulo || !descricao) { showAlert("alert-tarefa", "Título e descrição são obrigatórios."); return; }

  setLoading(btn, true, "Salvar");
  try {
    const payload = { titulo, descricao, status, prazo, responsavel_id };
    if (editingTarefaId) await TarefaAPI.atualizar(projetoId, editingTarefaId, payload);
    else await TarefaAPI.criar(projetoId, payload);
    closeModal("modal-tarefa");
    await loadTarefas();
  } catch (err) {
    showAlert("alert-tarefa", (err as Error).message);
  } finally {
    setLoading(btn, false, "Salvar");
  }
}

async function confirmDeleteTarefa(id: number): Promise<void> {
  const t = tarefas.find((x) => x.id === id);
  if (!t || !confirm(`Excluir tarefa "${t.titulo}"?`)) return;
  try {
    await TarefaAPI.excluir(projetoId, id);
    await loadTarefas();
  } catch (err) {
    alert((err as Error).message);
  }
}

// ── Projeto Edit / Delete ─────────────────────────────────────────────────

function openEditProject(): void {
  if (!projeto) return;
  (document.getElementById("edit-nome")      as HTMLInputElement).value    = projeto.nome;
  (document.getElementById("edit-descricao") as HTMLTextAreaElement).value = projeto.descricao;
  clearAlert("alert-edit-project");
  openModal("modal-edit-project");
}

async function saveEditProject(btn: HTMLButtonElement): Promise<void> {
  const nome      = (document.getElementById("edit-nome")      as HTMLInputElement).value.trim();
  const descricao = (document.getElementById("edit-descricao") as HTMLTextAreaElement).value.trim();
  if (!nome || !descricao) { showAlert("alert-edit-project", "Preencha todos os campos."); return; }

  setLoading(btn, true, "Salvar");
  try {
    projeto = await ProjetoAPI.atualizar(projetoId, { nome, descricao });
    closeModal("modal-edit-project");
    renderHeader();
  } catch (err) {
    showAlert("alert-edit-project", (err as Error).message);
  } finally {
    setLoading(btn, false, "Salvar");
  }
}

function openDeleteProject(): void {
  if (!projeto) return;
  document.getElementById("delete-project-name")!.textContent = projeto.nome;
  openModal("modal-delete-project");
}

async function executeDeleteProject(): Promise<void> {
  const btn = document.getElementById("btn-confirm-delete-project") as HTMLButtonElement;
  setLoading(btn, true, "Excluir definitivamente");
  try {
    await ProjetoAPI.excluir(projetoId);
    window.location.href = "dashboard.html";
  } catch (err) {
    closeModal("modal-delete-project");
    alert((err as Error).message);
  } finally {
    setLoading(btn, false, "Excluir definitivamente");
  }
}

// ── Convidar membro ───────────────────────────────────────────────────────

async function sendInvite(btn: HTMLButtonElement): Promise<void> {
  const username = (document.getElementById("invite-username") as HTMLInputElement).value.trim();
  if (!username) { showAlert("alert-invite", "Informe o username."); return; }

  setLoading(btn, true, "Convidar");
  try {
    await ConviteAPI.enviar(projetoId, username);
    (document.getElementById("invite-username") as HTMLInputElement).value = "";
    showAlert("alert-invite", `Convite enviado para @${username}!`, "success");
    await loadConvites();
  } catch (err) {
    showAlert("alert-invite", (err as Error).message);
  } finally {
    setLoading(btn, false, "Convidar");
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLElement>(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    const tab = t.dataset["tab"]!;
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.querySelector(`.tab-content[data-content="${tab}"]`)?.classList.add("active");
  });
});

// ── Utilitário ────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}