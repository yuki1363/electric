export type Tool = 'select' | 'wire' | 'text' | 'place';

export const TOOL_LABEL: Record<Tool, string> = {
  select: '選択',
  wire: '配線',
  text: 'テキスト',
  place: '配置',
};

/** ユーザーが直接切り替えられるツール（place はパレットで部品を選ぶと入る） */
export const PICKABLE_TOOLS: Tool[] = ['select', 'wire', 'text'];
