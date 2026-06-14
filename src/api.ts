/**
 * api.ts — Cliente HTTP centralizado para a Academic Projects API.
 *
 * Responsabilidades:
 *  - Adicionar cabeçalho Authorization em todas as requisições autenticadas.
 *  - Tentar renovar o access token automaticamente ao receber 401.
 *  - Expor helpers tipados para cada recurso da API.
 */

// URL base da API — altere para a URL de produção antes de publicar
export const API_URL: string =
  (window as Window & { API_URL?: string }).API_URL ??
  "http://localhost:8000/api";

// ── Tipos compartilhados ─────────────────────────────────────────────────

export interface UsuarioResumo {
  id: number;
  username: string;
  email: string;
  nome_completo: string;
}

export interface Perfil {
  username: string;
  email: string;
  nome: string;
  sobrenome: string;
  matricula: string;
}

export interface Projeto {
  id: number;
  nome: string;
  descricao: string;
  criado_por: UsuarioResumo;
  criado_em: string;
  atualizado_em: string;
  total_membros: number;
  total_tarefas: number;
  meu_papel: string | null;
}

export interface MembroProjeto {
  id: number;
  usuario: UsuarioResumo;
  papel: "L" | "M";
  papel_display: string;
  data_entrada: string;
}

export interface Convite {
  id: number;
  projeto: Projeto;
  convidado_por: UsuarioResumo;
  convidado: UsuarioResumo;
  status: "P" | "A" | "R";
  status_display: string;
  data_envio: string;
  data_resposta: string | null;
}

export interface Tarefa {
  id: number;
  titulo: string;
  descricao: string;
  projeto: number;
  responsavel: UsuarioResumo | null;
  status: "P" | "E" | "C";
  status_display: string;
  prazo: string | null;
  criado_em: string;
  atualizado_em: string;
  total_observacoes: number;
}

export interface Observacao {
  id: number;
  texto: string;
  autor: UsuarioResumo;
  tarefa: number;
  criado_em: string;
  atualizado_em: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface ApiError {
  [key: string]: string | string[];
}

// ── Token storage ────────────────────────────────────────────────────────

export const TokenStore = {
  getAccess: (): string | null => localStorage.getItem("access_token"),
  getRefresh: (): string | null => localStorage.getItem("refresh_token"),
  set: (access: string, refresh: string): void => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  },
  setAccess: (access: string): void => {
    localStorage.setItem("access_token", access);
  },
  clear: (): void => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("current_user");
  },
  isLogged: (): boolean => !!localStorage.getItem("access_token"),
};

// ── Token refresh ────────────────────────────────────────────────────────

async function tryRefresh(): Promise<boolean> {
  const refresh = TokenStore.getRefresh();
  if (!refresh) return false;

  const res = await fetch(`${API_URL}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (res.ok) {
    const data = await res.json();
    TokenStore.setAccess(data.access);
    return true;
  }
  return false;
}

// ── Core fetch wrapper ───────────────────────────────────────────────────

interface FetchOptions extends RequestInit {
  auth?: boolean;          // true por padrão
  noContentType?: boolean; // true para não setar Content-Type (FormData)
}

export async function apiFetch(
  path: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { auth = true, noContentType = false, ...rest } = options;

  const headers = new Headers(rest.headers);
  if (!noContentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = TokenStore.getAccess();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(`${API_URL}${path}`, { ...rest, headers });

  // Tenta renovar o token uma vez em caso de 401
  if (res.status === 401 && auth) {
    const renewed = await tryRefresh();
    if (renewed) {
      headers.set("Authorization", `Bearer ${TokenStore.getAccess()}`);
      res = await fetch(`${API_URL}${path}`, { ...rest, headers });
    } else {
      TokenStore.clear();
      window.location.href = "index.html";
    }
  }

  return res;
}

// ── Helper: normaliza resposta paginada ou array direto ──────────────────

/**
 * O backend usa PageNumberPagination (PAGE_SIZE=20) globalmente.
 * Listagens retornam { count, next, previous, results: [...] }.
 * Algumas rotas customizadas retornam array direto.
 * Normaliza os dois formatos.
 */
async function extractList<T>(res: Response): Promise<T[]> {
  const data = await res.json();
  if (data && Array.isArray(data.results)) return data.results as T[];
  if (Array.isArray(data)) return data as T[];
  return [];
}

// ── Helper: extrai mensagem de erro legível ──────────────────────────────

export async function extractError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    // Junta todos os valores do objeto de erros
    return Object.values(data)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .join(" | ");
  } catch {
    return `Erro ${res.status}`;
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────

export const AuthAPI = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await apiFetch("/auth/login/", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async registrar(data: {
    username: string;
    email: string;
    password: string;
    password2: string;
    nome: string;
    sobrenome: string;
    matricula: string;
  }): Promise<void> {
    const res = await apiFetch("/auth/registrar/", {
      method: "POST",
      auth: false,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractError(res));
  },

  async logout(): Promise<void> {
    const refresh = TokenStore.getRefresh();
    await apiFetch("/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }).catch(() => null);
    TokenStore.clear();
  },

  async getPerfil(): Promise<Perfil> {
    const res = await apiFetch("/auth/perfil/");
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async updatePerfil(data: Partial<Pick<Perfil, "nome" | "sobrenome" | "matricula">>): Promise<Perfil> {
    const res = await apiFetch("/auth/perfil/", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  /**
   * Troca a senha do usuário autenticado.
   *
   * Em caso de sucesso, o backend retorna novos tokens JWT.
   * O frontend deve atualizar o TokenStore para manter a sessão ativa.
   *
   * @param senhaAtual  Senha atual do usuário (para confirmação).
   * @param novaSenha   Nova senha desejada.
   * @param novaSenha2  Confirmação da nova senha.
   * @returns           Objeto com mensagem e novos tokens JWT.
   */
  async trocarSenha(
    senhaAtual: string,
    novaSenha: string,
    novaSenha2: string
  ): Promise<{ mensagem: string; tokens: LoginResponse }> {
    const res = await apiFetch("/auth/trocar-senha/", {
      method: "POST",
      body: JSON.stringify({
        senha_atual: senhaAtual,
        nova_senha: novaSenha,
        nova_senha2: novaSenha2,
        refresh_token: TokenStore.getRefresh(), // para invalidar o token atual no backend
      }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },
};

// ── Projetos ──────────────────────────────────────────────────────────────

export const ProjetoAPI = {
  async listar(): Promise<Projeto[]> {
    const res = await apiFetch("/projetos/");
    if (!res.ok) throw new Error(await extractError(res));
    return extractList<Projeto>(res);
  },

  async criar(nome: string, descricao: string): Promise<Projeto> {
    const res = await apiFetch("/projetos/", {
      method: "POST",
      body: JSON.stringify({ nome, descricao }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async detalhar(id: number): Promise<Projeto> {
    const res = await apiFetch(`/projetos/${id}/`);
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async atualizar(id: number, data: Partial<Pick<Projeto, "nome" | "descricao">>): Promise<Projeto> {
    const res = await apiFetch(`/projetos/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async excluir(id: number): Promise<void> {
    const res = await apiFetch(`/projetos/${id}/`, { method: "DELETE" });
    if (!res.ok) throw new Error(await extractError(res));
  },
};

// ── Membros ───────────────────────────────────────────────────────────────

export const MembroAPI = {
  async listar(projetoId: number): Promise<MembroProjeto[]> {
    const res = await apiFetch(`/projetos/${projetoId}/membros/`);
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async remover(projetoId: number, membroId: number): Promise<void> {
    const res = await apiFetch(`/projetos/${projetoId}/membros/${membroId}/`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await extractError(res));
  },
};

// ── Convites ──────────────────────────────────────────────────────────────

export const ConviteAPI = {
  async meus(): Promise<Convite[]> {
    const res = await apiFetch("/convites/");
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async doprojeto(projetoId: number): Promise<Convite[]> {
    const res = await apiFetch(`/projetos/${projetoId}/convites/`);
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async enviar(projetoId: number, usernameConvidado: string): Promise<Convite> {
    const res = await apiFetch(`/projetos/${projetoId}/convites/`, {
      method: "POST",
      body: JSON.stringify({ username_convidado: usernameConvidado }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async aceitar(conviteId: number): Promise<void> {
    const res = await apiFetch(`/convites/${conviteId}/aceitar/`, { method: "POST" });
    if (!res.ok) throw new Error(await extractError(res));
  },

  async recusar(conviteId: number): Promise<void> {
    const res = await apiFetch(`/convites/${conviteId}/recusar/`, { method: "POST" });
    if (!res.ok) throw new Error(await extractError(res));
  },
};

// ── Tarefas ───────────────────────────────────────────────────────────────

export type TarefaPayload = {
  titulo: string;
  descricao: string;
  responsavel_id?: number | null;
  status: "P" | "E" | "C";
  prazo?: string | null;
};

export const TarefaAPI = {
  async listar(projetoId: number): Promise<Tarefa[]> {
    const res = await apiFetch(`/projetos/${projetoId}/tarefas/`);
    if (!res.ok) throw new Error(await extractError(res));
    return extractList<Tarefa>(res);
  },

  async criar(projetoId: number, data: TarefaPayload): Promise<Tarefa> {
    const res = await apiFetch(`/projetos/${projetoId}/tarefas/`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async detalhar(projetoId: number, tarefaId: number): Promise<Tarefa> {
    const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/`);
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async atualizar(projetoId: number, tarefaId: number, data: Partial<TarefaPayload>): Promise<Tarefa> {
    const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async excluir(projetoId: number, tarefaId: number): Promise<void> {
    const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await extractError(res));
  },
};

// ── Observações ───────────────────────────────────────────────────────────

export const ObsAPI = {
  async listar(projetoId: number, tarefaId: number): Promise<Observacao[]> {
    const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/observacoes/`);
    if (!res.ok) throw new Error(await extractError(res));
    return extractList<Observacao>(res);
  },

  async criar(projetoId: number, tarefaId: number, texto: string): Promise<Observacao> {
    const res = await apiFetch(`/projetos/${projetoId}/tarefas/${tarefaId}/observacoes/`, {
      method: "POST",
      body: JSON.stringify({ texto }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async atualizar(projetoId: number, tarefaId: number, obsId: number, texto: string): Promise<Observacao> {
    const res = await apiFetch(
      `/projetos/${projetoId}/tarefas/${tarefaId}/observacoes/${obsId}/`,
      { method: "PATCH", body: JSON.stringify({ texto }) }
    );
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
  },

  async excluir(projetoId: number, tarefaId: number, obsId: number): Promise<void> {
    const res = await apiFetch(
      `/projetos/${projetoId}/tarefas/${tarefaId}/observacoes/${obsId}/`,
      { method: "DELETE" }
    );
    if (!res.ok) throw new Error(await extractError(res));
  },
};