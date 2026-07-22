const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetcher(url) {
  const res = await fetch(`${API_URL}${url}`);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

export async function createTask(description, mode) {
  const params = new URLSearchParams({ description, mode });
  const res = await fetch(`${API_URL}/tasks?${params.toString()}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to create task: ${res.status}`);
  }
  return res.json();
}

export async function approveTask(taskId) {
  const res = await fetch(`${API_URL}/tasks/${taskId}/approve`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to approve task: ${res.status}`);
  }
  return res.json();
}

export async function rejectTask(taskId) {
  const res = await fetch(`${API_URL}/tasks/${taskId}/reject`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to reject task: ${res.status}`);
  }
  return res.json();
}