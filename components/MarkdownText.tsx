import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { ColorPalette } from '@/constants/colors'

type Props = { text: string; C: ColorPalette; isMe?: boolean }

// Parses **bold**, *italic*, ~strike~, `inline code` within a single line
function parseInline(line: string, base: object, isMe: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pat = /(\*\*(.+?)\*\*|\*(.+?)\*|~(.+?)~|`([^`]+)`)/g
  let last = 0, match: RegExpExecArray | null, k = 0
  while ((match = pat.exec(line)) !== null) {
    if (match.index > last) {
      nodes.push(<Text key={k++} style={base}>{line.slice(last, match.index)}</Text>)
    }
    if (match[2] !== undefined) {
      nodes.push(<Text key={k++} style={[base, { fontWeight: '700' }]}>{match[2]}</Text>)
    } else if (match[3] !== undefined) {
      nodes.push(<Text key={k++} style={[base, { fontStyle: 'italic' }]}>{match[3]}</Text>)
    } else if (match[4] !== undefined) {
      nodes.push(<Text key={k++} style={[base, { textDecorationLine: 'line-through', opacity: 0.6 }]}>{match[4]}</Text>)
    } else if (match[5] !== undefined) {
      nodes.push(
        <Text key={k++} style={[base, styles.inlineCode, {
          backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
        }]}>
          {match[5]}
        </Text>
      )
    }
    last = match.index + match[0].length
  }
  if (last < line.length) {
    nodes.push(<Text key={k++} style={base}>{line.slice(last)}</Text>)
  }
  return nodes
}

export function MarkdownText({ text, C, isMe = false }: Props) {
  const color = isMe ? C.white : C.navy
  const base = { fontSize: 14, color, lineHeight: 21 } as const

  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let inCode = false
  let codeLines: string[] = []
  let key = 0
  const k = () => String(key++)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ─── Code block fence ───────────────────────────────────────────────────
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        elements.push(
          <View key={k()} style={[styles.codeBlock, {
            backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)',
          }]}>
            <Text style={[styles.codeText, { color }]}>{codeLines.join('\n')}</Text>
          </View>
        )
        codeLines = []
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    // ─── Blank line → vertical rhythm ────────────────────────────────────────
    if (!line.trim()) {
      // Only insert gap if the previous line wasn't also blank
      if (i > 0 && lines[i - 1].trim()) {
        elements.push(<View key={k()} style={{ height: 5 }} />)
      }
      continue
    }

    // ─── Heading: ### Title  or  **Entire Line Bold** ────────────────────────
    const hashM = line.match(/^#{1,3}\s+(.+)$/)
    const fullBoldM = !hashM && line.match(/^\*\*([^*]+)\*\*:?$/)
    if (hashM || fullBoldM) {
      const content = (hashM ?? fullBoldM)![1]
      elements.push(
        <Text key={k()} style={[base, { fontWeight: '800', fontSize: 15, marginTop: 4 }]}>
          {content}
        </Text>
      )
      continue
    }

    // ─── Numbered list: 1. 2. 3. ─────────────────────────────────────────────
    const numM = line.match(/^(\d+)\.\s+(.+)$/)
    if (numM) {
      elements.push(
        <View key={k()} style={styles.listRow}>
          <Text style={[base, { fontWeight: '700', minWidth: 22 }]}>{numM[1]}.</Text>
          <Text style={[base, { flex: 1 }]}>{parseInline(numM[2], base, isMe)}</Text>
        </View>
      )
      continue
    }

    // ─── Bullet: • or - ──────────────────────────────────────────────────────
    const bulM = line.match(/^([•\-*✓])\s+(.+)$/)
    if (bulM) {
      elements.push(
        <View key={k()} style={styles.listRow}>
          <Text style={[base, { fontWeight: '700', minWidth: 14 }]}>•</Text>
          <Text style={[base, { flex: 1 }]}>{parseInline(bulM[2], base, isMe)}</Text>
        </View>
      )
      continue
    }

    // ─── Regular paragraph line ───────────────────────────────────────────────
    elements.push(
      <Text key={k()} style={base}>
        {parseInline(line, base, isMe)}
      </Text>
    )
  }

  return <View>{elements}</View>
}

const styles = StyleSheet.create({
  inlineCode: { fontFamily: 'monospace', borderRadius: 4, paddingHorizontal: 4, fontSize: 13 },
  codeBlock:  { borderRadius: 10, padding: 10, marginVertical: 4 },
  codeText:   { fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
  listRow:    { flexDirection: 'row', gap: 6, marginBottom: 2, alignItems: 'flex-start' },
})
