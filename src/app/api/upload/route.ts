import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)

  if (isImage) {
    return NextResponse.json({ name: file.name, type: 'image', extractedText: undefined })
  }

  if (ext === 'pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const result = await pdfParse(buffer)
      return NextResponse.json({ name: file.name, type: 'pdf', extractedText: result.text })
    } catch {
      return NextResponse.json({ name: file.name, type: 'pdf', extractedText: undefined })
    }
  }

  // txt
  if (ext === 'txt') {
    const text = buffer.toString('utf-8')
    return NextResponse.json({ name: file.name, type: 'txt', extractedText: text })
  }

  if (ext === 'pptx' || ext === 'ppt') {
    try {
      const officeParser = (await import('officeparser')).default
      const text: string = await new Promise((resolve, reject) => {
        officeParser.parseOfficeAsync(buffer, { outputErrorToConsole: false })
          .then(resolve)
          .catch(reject)
      })
      return NextResponse.json({ name: file.name, type: 'pptx', extractedText: text })
    } catch {
      return NextResponse.json({ name: file.name, type: 'pptx', extractedText: undefined })
    }
  }

  return NextResponse.json({ name: file.name, type: 'txt', extractedText: undefined })
}
