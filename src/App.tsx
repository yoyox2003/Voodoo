import "./App.css";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">TooDoo — Tailwind Test</h1>

        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="New todo..."
          />
          <button className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
            Add
          </button>
        </div>

        <ul className="space-y-2">
          <li className="p-2 bg-gray-100 rounded flex justify-between items-center">
            <span>Sample todo item</span>
            <button className="text-sm text-indigo-600">Done</button>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default App;
