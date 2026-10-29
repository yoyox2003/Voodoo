import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey } from "../hooks/useWorkspaceData";
import { useToast } from "../toast/useToast";
import type { Bucket, Folder as FolderEntity, Subtask, Task } from "../types/entities";
import { Button } from "../UI/Button";

export function SidebarFolderActions({ folder, buckets, tasks, active, onNavigate, linkClass }: {
  folder: FolderEntity;
  buckets: Bucket[];
  tasks: Task[];
  active: boolean;
  onNavigate: () => void;
  linkClass: (active: boolean) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saving = useRef(false);
  const cancelBlur = useRef(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { userId } = useAuth();
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const foldersKey = apiQueryKey(userId, "/api/folders");
  const bucketsKey = apiQueryKey(userId, "/api/buckets");
  const tasksKey = apiQueryKey(userId, "/api/tasks");
  const subtasksKey = apiQueryKey(userId, "/api/subtasks");

  useEffect(() => {
    if (!confirmDelete) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [confirmDelete]);

  const rename = useMutation({
    mutationFn: (nextName: string) => request<FolderEntity>(`/api/folders/${folder.id}`, {
      method: "PUT", body: JSON.stringify({ name: nextName }),
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData<FolderEntity[]>(foldersKey, (current = []) =>
        current.map((item) => item.id === updated.id ? updated : item));
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: foldersKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to rename folder."),
    onSettled: () => { saving.current = false; },
  });
  const remove = useMutation({
    mutationFn: () => request<void>(`/api/folders/${folder.id}`, { method: "DELETE" }),
    onSuccess: () => {
      const bucketIds = new Set(buckets.map((bucket) => bucket.id));
      const taskIds = new Set(tasks.filter((task) => bucketIds.has(task.bucketId)).map((task) => task.id));
      queryClient.setQueryData<FolderEntity[]>(foldersKey, (current = []) => current.filter((item) => item.id !== folder.id));
      queryClient.setQueryData<Bucket[]>(bucketsKey, (current = []) => current.filter((bucket) => bucket.folderId !== folder.id));
      queryClient.setQueryData<Task[]>(tasksKey, (current = []) => current.filter((task) => !bucketIds.has(task.bucketId)));
      queryClient.setQueryData<Subtask[]>(subtasksKey, (current = []) => current.filter((subtask) => !taskIds.has(subtask.taskId)));
      if (active) { navigate("/"); onNavigate(); }
      toast.success("Folder deleted.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to delete folder."),
    onSettled: () => {
      for (const queryKey of [foldersKey, bucketsKey, tasksKey, subtasksKey]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  function saveName() {
    if (saving.current || cancelBlur.current) return;
    const nextName = name.trim();
    if (!nextName) { toast.error("Enter a folder name."); return; }
    if (nextName === folder.name) { setEditing(false); return; }
    saving.current = true;
    rename.mutate(nextName);
  }

  return <>
    {editing ? <div className="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-1.5 text-sm"><Folder aria-hidden="true" className="shrink-0" size={16} /><input aria-label={`Rename ${folder.name}`} autoFocus className="min-w-0 flex-1 rounded-sm border-0 bg-[#fff6f1] p-0 outline-none disabled:opacity-60 dark:bg-[#332724]" disabled={rename.isPending} value={name} onChange={(event) => setName(event.target.value)} onBlur={saveName} onKeyDown={(event) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Enter") { event.preventDefault(); saveName(); }
      if (event.key === "Escape") { event.preventDefault(); cancelBlur.current = true; setEditing(false); }
    }} /></div> : <NavLink viewTransition className={({ isActive }) => `${linkClass(isActive)} min-w-0 flex-1 px-1.5`} onClick={onNavigate} to={`/folders/${folder.id}`}><Folder aria-hidden="true" size={16} /><span className="truncate">{folder.name}</span></NavLink>}
    <div className="relative shrink-0" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }} onKeyDown={(event) => {
      if (event.key === "Escape" && menuOpen) { event.preventDefault(); event.stopPropagation(); setMenuOpen(false); menuButton.current?.focus(); }
    }}>
      <button aria-expanded={menuOpen} aria-label={`Options for ${folder.name}`} className="grid h-8 w-8 place-items-center rounded text-[#8a837c] transition-colors duration-150 hover:bg-[#f3f1ef] focus-visible:ring-2 focus-visible:ring-[#d95d47] motion-reduce:transition-none dark:text-[#aaa29b] dark:hover:bg-[#302d29]" onClick={() => setMenuOpen((open) => !open)} ref={menuButton} type="button"><MoreHorizontal aria-hidden="true" size={19} /></button>
      <div aria-hidden={!menuOpen} inert={!menuOpen} className={`absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[#dedad4] bg-white p-2 text-sm shadow-lg transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none dark:border-[#494642] dark:bg-[#292724] ${menuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}>
        <button className="w-full rounded px-2 py-2 text-left transition-colors hover:bg-[#f3f1ef] dark:hover:bg-[#302d29]" onClick={() => { setMenuOpen(false); cancelBlur.current = false; setName(folder.name); setEditing(true); }} type="button">Rename</button>
        <button className="w-full rounded px-2 py-2 text-left text-[#b74131] transition-colors hover:bg-[#fff0ed] dark:text-[#ff9680] dark:hover:bg-[#482923]" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }} type="button">Delete</button>
      </div>
    </div>
    {confirmDelete && <dialog aria-labelledby="delete-folder-title" aria-describedby="delete-folder-description" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-[#e9e5e2] bg-[#fffdfc] p-6 text-[#292827] shadow-2xl backdrop:bg-[#282522]/35 dark:border-[#413c38] dark:bg-[#252220] dark:text-[#f3efea]" onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!remove.isPending) setConfirmDelete(false); }} ref={dialogRef}>
      <h2 className="text-lg font-semibold" id="delete-folder-title">Delete folder?</h2>
      <p className="mt-3 text-sm leading-6 text-[#716a64] dark:text-[#b9b1aa]" id="delete-folder-description">Delete “{folder.name}” and all its buckets, tasks, and subtasks? This cannot be undone.</p>
      <div className="mt-6 flex justify-end gap-3"><Button autoFocus disabled={remove.isPending} onClick={() => setConfirmDelete(false)} variant="ghost">Cancel</Button><Button disabled={remove.isPending} onClick={() => remove.mutate()} variant="danger">{remove.isPending ? "Deleting…" : "Delete"}</Button></div>
    </dialog>}
  </>;
}
