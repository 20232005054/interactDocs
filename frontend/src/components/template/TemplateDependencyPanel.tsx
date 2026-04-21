"use client"

import type {
  CoreInfoDependencyItem,
  StructureDependencyItem,
  SummaryDependencyItem,
  TemplateDependenciesResponse,
} from "@/types/api"

interface TemplateDependencyPanelProps {
  data: TemplateDependenciesResponse | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}

function RefTags({ title, items, emptyText }: { title: string; items: Array<{ label: string; field_key: string }>; emptyText: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-gray-500">{title}</span>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <span
              key={`${title}-${item.field_key}-${item.label}-${i}`}
              className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600"
            >
              {item.label}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-gray-400">{emptyText}</span>
      )}
    </div>
  )
}

function CoreInfoDependencyCard({ item }: { item: CoreInfoDependencyItem }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-800">{item.field_name}</span>
        <span className="font-mono text-[11px] text-gray-400">{item.field_key}</span>
      </div>
      <div className="mt-3">
        <RefTags
          title="被引用"
          items={item.referenced_by}
          emptyText="当前未被摘要或章节引用"
        />
      </div>
    </div>
  )
}

function SummaryDependencyCard({ item }: { item: SummaryDependencyItem }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-800">{item.title}</span>
        <span className="font-mono text-[11px] text-gray-400">{item.field_key}</span>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <RefTags title="引用来源" items={item.references} emptyText="当前未配置来源引用" />
        <RefTags title="被章节引用" items={item.referenced_by} emptyText="当前未被章节引用" />
      </div>
    </div>
  )
}

function StructureDependencyCard({ item }: { item: StructureDependencyItem }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-800">{item.title}</span>
        <span className="font-mono text-[11px] text-gray-400">{item.field_key}</span>
      </div>
      <div className="mt-3">
        <RefTags title="引用来源" items={item.references} emptyText="当前未配置来源引用" />
      </div>
    </div>
  )
}

function DependencySection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-800">{title}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">{count}</span>
      </div>
      {children}
    </section>
  )
}

export default function TemplateDependencyPanel({
  data,
  loading,
  error,
  onRefresh,
}: TemplateDependencyPanelProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">模板依赖关系</h2>
          <p className="mt-1 text-xs text-gray-500">
            查看核心信息、摘要和章节结构之间的引用链路，便于排查变量来源和模板影响面。
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="h-8 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
        >
          刷新依赖
        </button>
      </div>

      {loading && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-36 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="mt-4 grid gap-5 xl:grid-cols-3">
          <DependencySection title="核心信息引用" count={data.core_info_templates.length}>
            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
              {data.core_info_templates.length > 0 ? (
                data.core_info_templates.map((item) => (
                  <CoreInfoDependencyCard key={item.field_key} item={item} />
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                  暂无核心信息引用关系
                </p>
              )}
            </div>
          </DependencySection>

          <DependencySection title="摘要依赖" count={data.summary_templates.length}>
            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
              {data.summary_templates.length > 0 ? (
                data.summary_templates.map((item) => (
                  <SummaryDependencyCard key={item.field_key} item={item} />
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                  暂无摘要依赖关系
                </p>
              )}
            </div>
          </DependencySection>

          <DependencySection title="章节结构依赖" count={data.structure_templates.length}>
            <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
              {data.structure_templates.length > 0 ? (
                data.structure_templates.map((item) => (
                  <StructureDependencyCard key={item.field_key} item={item} />
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                  暂无章节依赖关系
                </p>
              )}
            </div>
          </DependencySection>
        </div>
      )}
    </div>
  )
}
