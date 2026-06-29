/**
 * components/dashboard/FolderTree.jsx
 *
 * Renders the repository's folder structure as a
 * nested visual tree. Accepts either a nested object
 * from the API or a flat array of path strings and
 * normalises both into a display-ready tree.
 *
 * Fully presentational — no state, no API calls.
 *
 * Placement: src/components/dashboard/FolderTree.jsx
 */

/**
 * Recursively renders one level of the directory tree.
 *
 * @param {{ node: object|string[], depth?: number }} props
 */
function TreeNode({ node, depth = 0 }) {
  const indent = depth * 14;

  // String leaf node (a filename)
  if (typeof node === "string") {
    return (
      <div
        className="flex items-center gap-[6px] py-[2px]"
        style={{ paddingLeft: `${indent + 14}px` }}
      >
        <i className="ti ti-file text-[11px] text-gray-muted flex-shrink-0" aria-hidden="true" />
        <span className="text-[11px] text-dark opacity-50 font-normal truncate">
          {node}
        </span>
      </div>
    );
  }

  // Array of strings (file list within a folder)
  if (Array.isArray(node)) {
    return (
      <>
        {node.map((filename, i) => (
          <TreeNode key={`${filename}-${i}`} node={filename} depth={depth} />
        ))}
      </>
    );
  }

  // Object — each key is a folder name, value is its contents
  if (typeof node === "object" && node !== null) {
    return (
      <>
        {Object.entries(node).map(([name, contents]) => (
          <div key={name}>
            {/* Folder row */}
            <div
              className="flex items-center gap-[6px] py-[3px]"
              style={{ paddingLeft: `${indent}px` }}
            >
              <i
                className="ti ti-folder text-[12px] text-accent flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-[11px] text-accent font-semibold">
                {name}
              </span>
            </div>

            {/* Folder contents */}
            <TreeNode node={contents} depth={depth + 1} />
          </div>
        ))}
      </>
    );
  }

  return null;
}

// ─── Fallback: build a tree from flat paths ───────────────────────────────

/**
 * buildTreeFromPaths
 *
 * Converts a flat array of file paths like:
 *   ["backend/main.py", "backend/services/api.py", "frontend/App.jsx"]
 * into a nested object:
 *   { backend: { "main.py": null, services: { "api.py": null } }, frontend: { "App.jsx": null } }
 *
 * Used when the API returns a flat paths array instead of
 * a nested object.
 */
function buildTreeFromPaths(paths) {
  const root = {};
  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        // Leaf — store null to mark as a file
        if (!Array.isArray(current[part])) {
          current[part] = null;
        }
      } else {
        // Branch — ensure object exists
        if (!current[part] || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = current[part];
      }
    }
  }
  return root;
}

// ─── Public component ─────────────────────────────────────────────────────

/**
 * @param {{
 *   folderTree: object | string[]   — nested object or flat path array
 *   folderCount: number
 * }} props
 */
export default function FolderTree({ folderTree, folderCount }) {
  // Normalise: if it's a flat array of paths, build a tree first
  const tree = Array.isArray(folderTree)
    ? buildTreeFromPaths(folderTree)
    : (folderTree ?? {});

  return (
    <div className="card-result p-[20px]">
      {/* Card header */}
      <div className="flex items-center gap-[10px] mb-[14px]">
        <div
          className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center text-[14px] text-accent flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(109,129,147,0.10), rgba(109,129,147,0.05))",
            border: "1px solid rgba(109,129,147,0.20)",
          }}
          aria-hidden="true"
        >
          <i className="ti ti-folder-open" />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-dark">Folder structure</p>
          <p className="text-[11px] text-accent mt-[1px]">
            {folderCount ?? "—"} {folderCount === 1 ? "directory" : "directories"} mapped
          </p>
        </div>
      </div>

      {/* Tree */}
      <div className="overflow-hidden">
        {Object.keys(tree).length > 0 ? (
          <TreeNode node={tree} depth={0} />
        ) : (
          <p className="text-[11px] text-gray-muted italic">No folder data available.</p>
        )}
      </div>
    </div>
  );
}