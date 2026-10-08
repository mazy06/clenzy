import { BookmarkIcon } from "../../../../icons/glyphs"

import { Toggle } from '../../../../components/ui'

export default function ToggleDemo() {
  return (
    <Toggle
      aria-label="Toggle bookmark"
      size="sm"
      variant="outline"
      className="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:text-blue-500"
    >
      <BookmarkIcon />
      Bookmark
    </Toggle>
  )
}
