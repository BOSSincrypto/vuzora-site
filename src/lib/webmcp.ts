import {
  findUniversity,
  universityPagePath,
  type University,
  UNIVERSITIES,
} from "@/content/universities";

type JsonSchema = {
  type: "object";
  properties: Record<string, { type: "string"; description: string }>;
  required: readonly string[];
  additionalProperties: false;
};

type BundledUniversity = Pick<University, "slug" | "code" | "name" | "city" | "status"> & {
  detailPath: string;
};

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: {
    readOnlyHint: true;
    untrustedContentHint: true;
  };
  execute: (input: unknown) => BundledUniversity[] | BundledUniversity | null;
};

type WebMcpModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>;
};

type WebMcpDocument = Document & {
  modelContext?: WebMcpModelContext;
};

const BUNDLED_UNIVERSITIES: readonly BundledUniversity[] = UNIVERSITIES.map((university) => ({
  slug: university.slug,
  code: university.code,
  name: university.name,
  city: university.city,
  status: university.status,
  detailPath: universityPagePath(university.slug),
}));

const SEARCH_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Устойчивый поиск по названию, коду, городу или slug из реестра.",
    },
  },
  required: ["query"],
  additionalProperties: false,
};

const LOOKUP_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    slug: {
      type: "string",
      description: "Точный slug записи из реестра поддерживаемых вузов.",
    },
  },
  required: ["slug"],
  additionalProperties: false,
};

function normalizeInput(input: unknown): Record<string, unknown> {
  return input !== null && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function bundledUniversity(university: University): BundledUniversity {
  return {
    slug: university.slug,
    code: university.code,
    name: university.name,
    city: university.city,
    status: university.status,
    detailPath: universityPagePath(university.slug),
  };
}

/**
 * Stable, read-only tools over the same registry used by public routes.
 *
 * The returned objects intentionally contain no schedule rows, credentials,
 * mutations, or network callbacks. A tool consumer can use detailPath to
 * continue ordinary site navigation, but this integration does not claim a
 * live schedule or a server protocol.
 */
export function createWebMcpTools(): readonly WebMcpTool[] {
  return [
    {
      name: "vuzora.search_universities",
      title: "Поиск вузов Vuzora",
      description:
        "Ищет записи в bundled-реестре поддерживаемых вузов Vuzora по названию, коду, городу или slug. Результат содержит только статические данные сайта.",
      inputSchema: SEARCH_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const query = normalizeInput(input).query;
        if (typeof query !== "string" || !query.trim()) return [];
        const needle = query.trim().toLocaleLowerCase("ru-RU");
        return BUNDLED_UNIVERSITIES.filter((university) =>
          [university.slug, university.code, university.name, university.city].some((value) =>
            value.toLocaleLowerCase("ru-RU").includes(needle),
          ),
        );
      },
    },
    {
      name: "vuzora.get_university",
      title: "Карточка вуза Vuzora",
      description:
        "Возвращает одну запись из bundled-реестра Vuzora по точному slug. Результат содержит только статические данные сайта.",
      inputSchema: LOOKUP_SCHEMA,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        const slug = normalizeInput(input).slug;
        if (typeof slug !== "string") return null;
        const university = findUniversity(slug);
        return university ? bundledUniversity(university) : null;
      },
    },
  ];
}

/**
 * Register the page-local tools when the experimental document API exists.
 * Registration failures are deliberately swallowed because WebMCP is
 * progressive enhancement and must never affect ordinary rendering.
 */
export function registerWebMcpTools(target: WebMcpDocument): () => void {
  const modelContext = target?.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    return () => {};
  }

  const controller = typeof AbortController === "function" ? new AbortController() : undefined;
  const options = controller ? { signal: controller.signal } : undefined;

  for (const tool of createWebMcpTools()) {
    void Promise.resolve(modelContext.registerTool(tool, options)).catch(() => {
      // Unsupported permissions, invalid experimental implementations, and
      // duplicate registrations must not break the page.
    });
  }

  return () => {
    controller?.abort();
  };
}
