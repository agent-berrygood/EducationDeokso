import React, { useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// Define the props for the Toolbar component
interface ToolbarProps {
  editor: Editor | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 border-b border-gray-300 bg-gray-50 rounded-t-lg">
      {/* Bold Button */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors
          ${editor.isActive('bold')
            ? 'bg-gray-800 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-200'
          }
          border border-gray-300 shadow-sm disabled:opacity-50`}
      >
        Bold
      </button>

      {/* Italic Button */}
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors
          ${editor.isActive('italic')
            ? 'bg-gray-800 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-200'
          }
          border border-gray-300 shadow-sm disabled:opacity-50`}
      >
        Italic
      </button>

      {/* Bullet List Button */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
        className={`px-3 py-1 rounded text-sm font-medium transition-colors
          ${editor.isActive('bulletList')
            ? 'bg-gray-800 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-200'
          }
          border border-gray-300 shadow-sm disabled:opacity-50`}
      >
        Bullet List
      </button>

      {/* Ordered List Button */}
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
        className={`px-3 py-1 rounded text-sm font-medium transition-colors
          ${editor.isActive('orderedList')
            ? 'bg-gray-800 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-200'
          }
          border border-gray-300 shadow-sm disabled:opacity-50`}
      >
        Ordered List
      </button>
    </div>
  );
};

// Define the props for the RichTextEditor component
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure extensions as needed
        heading: {
          levels: [1, 2, 3],
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none min-h-[200px] p-4 border border-gray-300 border-t-0 rounded-b-lg bg-white',
      },
    },
  });

  // Sync external value changes with the editor
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false }); // Prevent firing the `onUpdate` callback
    }
  }, [value, editor]);

  return (
    <div className="rounded-lg shadow-md">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
