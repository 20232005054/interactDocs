import TemplateEditorContainer from "@/containers/TemplateEditorContainer"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params
  return <TemplateEditorContainer templateId={id} />
}
