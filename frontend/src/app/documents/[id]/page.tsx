import DocumentEditorContainer from "@/containers/DocumentEditorContainer"

interface Props {
  params: Promise<{ id: string }>
}

export default async function DocumentEditorPage({ params }: Props) {
  const { id } = await params
  return <DocumentEditorContainer documentId={id} />
}
