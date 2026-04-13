import ApplyTemplateEditorContainer from "@/containers/ApplyTemplateEditorContainer"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ApplyTemplatePage({ params }: Props) {
  const { id } = await params
  return <ApplyTemplateEditorContainer documentId={id} />
}
