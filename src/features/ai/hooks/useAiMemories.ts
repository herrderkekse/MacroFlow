import { addMemory, deleteMemory, getAllMemories, updateMemory, type AiMemory } from "../services/aiMemoriesDb";
import { useCallback, useState } from "react";

export function useAiMemories() {
    const [memories, setMemories] = useState<AiMemory[]>(() => getAllMemories());
    const [newText, setNewText] = useState("");
    const [editId, setEditId] = useState<number | null>(null);
    const [editText, setEditText] = useState("");

    const refresh = useCallback(() => setMemories(getAllMemories()), []);

    function handleAdd() {
        const text = newText.trim();
        if (!text) return;
        addMemory(text);
        setNewText("");
        refresh();
    }

    function startEdit(memory: AiMemory) {
        setEditId(memory.id);
        setEditText(memory.content);
    }

    function cancelEdit() {
        setEditId(null);
        setEditText("");
    }

    function handleSaveEdit() {
        if (editId === null) return;
        const text = editText.trim();
        if (!text) return;
        updateMemory(editId, text);
        setEditId(null);
        setEditText("");
        refresh();
    }

    function handleDelete(id: number) {
        deleteMemory(id);
        refresh();
    }

    return {
        memories,
        newText,
        setNewText,
        editId,
        editText,
        setEditText,
        handleAdd,
        startEdit,
        cancelEdit,
        handleSaveEdit,
        handleDelete,
    };
}
