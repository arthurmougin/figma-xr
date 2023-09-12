export function isLoggedIn() {
	const access_token = localStorage.getItem('access_token')
	const expires_in = localStorage.getItem('expires_in')
	if (access_token === null || expires_in === null) {
		return false
	}
	if (Date.now() > parseInt(expires_in)) {
		return false
	}
	return true
}

export function storeProject(project:any){
	if(project.id === undefined){
		project.id = Date.now()
	}
	localStorage.setItem(`project_${project.id}`, JSON.stringify(project))
	const projects = localStorage.getItem('projects') ? JSON.parse(localStorage.getItem('projects') as string) : [];
	projects.push(project.id);
	localStorage.setItem('projects', JSON.stringify(projects));
	return project.id;
}

export function getProject(projectId:string){
	if (!localStorage.getItem(`project_${projectId}`) || localStorage.getItem(`project_${projectId}`) === null) {
		const projects = localStorage.getItem('projects') ? JSON.parse(localStorage.getItem('projects') as string) : [];
		const index = projects.indexOf(projectId);
		if (index > -1) {
			projects.splice(index, 1);
		}
		localStorage.setItem('projects', JSON.stringify(projects));
		return null;
	}

	return JSON.parse(localStorage.getItem(`project_${projectId}`) as string));
}

export function deleteProject(projectId:string){
	localStorage.removeItem(`project_${projectId}`);
	const projects = localStorage.getItem('projects') ? JSON.parse(localStorage.getItem('projects') as string) : [];
	const index = projects.indexOf(projectId);
	if (index > -1) {
		projects.splice(index, 1);
	}
	localStorage.setItem('projects', JSON.stringify(projects));
}

export function getAllProjects() {
	const projects = localStorage.getItem('projects') ? JSON.parse(localStorage.getItem('projects') as string) : [];
	return projects.map((projectId:string) => JSON.parse(getProject(projectId) as string));
}