# Analyze the task dependency graph

tasks = {
    "task-1": [],
    "task-2": ["task-1"],
    "task-3": ["task-2"],
    "task-4": ["task-3"],
    "task-5": ["task-3"],
    "task-6": ["task-5"],
    "task-7": ["task-6"],
    "task-8": ["task-7"],
    "task-9": [],
    "task-10": [],
    "task-11": ["task-10"],
    "task-12": ["task-10"],
    "task-13": ["task-7"],
    "task-14": ["task-13"],
    "task-15": ["task-10"],
}

# 1. Check for unique task IDs
task_ids = list(tasks.keys())
unique_ids = len(task_ids) == len(set(task_ids))
print("=" * 60)
print("TASK DEPENDENCY GRAPH ANALYSIS")
print("=" * 60)
print(f"\n1. UNIQUE TASK IDs:")
print(f"   - Total tasks: {len(task_ids)}")
print(f"   - Unique IDs: {len(set(task_ids))}")
print(f"   - All unique: {'YES' if unique_ids else 'NO'}")

# 2. Find entry points (tasks with no dependencies)
entry_points = [task for task, deps in tasks.items() if len(deps) == 0]
print(f"\n2. ENTRY POINTS (tasks with no dependencies):")
print(f"   - Count: {len(entry_points)}")
print(f"   - Tasks: {sorted(entry_points)}")

# 3. Check for cycles using DFS
def has_cycle(graph):
    """Check if graph has cycles using DFS"""
    visited = set()
    rec_stack = set()
    
    def dfs(node):
        visited.add(node)
        rec_stack.add(node)
        
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True
        
        rec_stack.remove(node)
        return False
    
    # Build reverse graph (parent -> children)
    reverse_graph = {task: [] for task in graph}
    for task, deps in graph.items():
        for dep in deps:
            reverse_graph[dep].append(task)
    
    for task in graph:
        if task not in visited:
            if dfs(task):
                return True
    return False

# Build adjacency list (task -> its dependents)
adjacency = {task: [] for task in tasks}
for task, deps in tasks.items():
    for dep in deps:
        adjacency[dep].append(task)

is_valid_dag = not has_cycle(tasks)
print(f"\n3. CYCLE DETECTION:")
print(f"   - Is valid DAG (no cycles): {'YES' if is_valid_dag else 'NO'}")

# 4. Additional analysis
print(f"\n4. GRAPH STRUCTURE SUMMARY:")
print(f"   - Total nodes: {len(tasks)}")
print(f"   - Total edges: {sum(len(deps) for deps in tasks.values())}")

# Find tasks with no dependents (sink nodes)
dependents = set()
for deps in tasks.values():
    dependents.update(deps)
exit_points = [task for task in tasks if task not in dependents]
print(f"   - Exit points (no dependents): {sorted(exit_points)}")
print(f"   - Number of exit points: {len(exit_points)}")

# Find tasks with multiple dependencies
multi_deps = {task: deps for task, deps in tasks.items() if len(deps) > 1}
if multi_deps:
    print(f"   - Tasks with multiple dependencies: {len(multi_deps)}")
    for task, deps in sorted(multi_deps.items()):
        print(f"     * {task}: {deps}")
else:
    print(f"   - Tasks with multiple dependencies: 0")

print("\n" + "=" * 60)
print("FINAL VERDICT")
print("=" * 60)
print(f"Valid DAG: {is_valid_dag}")
print(f"All IDs unique: {unique_ids}")
print(f"Entry points count: {len(entry_points)}")
print(f"Entry points: {sorted(entry_points)}")
print("=" * 60)

