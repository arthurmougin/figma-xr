

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

	return JSON.parse(localStorage.getItem(`project_${projectId}`) as string);
}

export function deleteProject(projectId:string){
	localStorage.removeItem(`project_${projectId}`);
	const projects = localStorage.getItem('projects') ? (JSON.parse(localStorage.getItem('projects') as string)) : [];
	const index = projects.indexOf(projectId);
	if (index > -1) {
		projects.splice(index, 1);
	}
	localStorage.setItem('projects', JSON.stringify(projects));
}

export function updateProject(project:any){
	localStorage.setItem(`project_${project.id}`, JSON.stringify(project))
}

export function getAllProjects() {
	const projects = localStorage.getItem('projects') ? JSON.parse(localStorage.getItem('projects') as string) : [];
	console.log(projects)
	return projects.map((projectId:string) => getProject(projectId));
}

export function login() {
	const currentUrl = new URL(window.location.href);
	const state = Math.random().toString(36).substring(7);
	localStorage.setItem('figmaState', state)
	const url = new URL(`https://www.figma.com/oauth?client_id=${import.meta.env.VITE_ID}&redirect_uri=${encodeURI(currentUrl.toString())}?callback&scope=file_read&state=${state}&response_type=code`)
	window.location.replace(url.toString())
}

export function logout(router:any) {
	console.log('logout util')
	localStorage.removeItem('access_token')
	localStorage.removeItem('expires_in')
	localStorage.removeItem('refresh_token')
	localStorage.removeItem('figmaState')
	//remove all projects in storage
	const projects = getAllProjects();
	projects.forEach((project:any) => {
		deleteProject(project.id);
	});
	//navigate to landingpage
	router.push({ name: 'landingpage' });
}