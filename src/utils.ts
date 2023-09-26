import localForage from 'localforage'

export async function isLoggedIn() {
	const access_token = await localForage.getItem('access_token')
	const expires_in = await localForage.getItem('expires_in') as string
	if (access_token === null || expires_in === null) {
		return false
	}
	if (Date.now() > parseInt(expires_in)) {
		return false
	}
	return true
}

export async function storeProject(project:any){
	console.log('storing project', project)
	if(project.status == 404){
		console.log('Project not found')
		throw new Error('Project not found')
	}
	if(project.id === undefined){
		project.id = Date.now()
	}
	await localForage.setItem(`project_${project.id}`, project)
	const projects = await localForage.getItem('projects') as any[] || [];
	projects.push(project.id)
	await localForage.setItem('projects', projects)
	console.log('project stored')
}

export async function getProject(projectId:string){
	console.log('getting project', projectId)
	const project = await localForage.getItem(`project_${projectId}`) || undefined;
	if	(project === undefined) {
		throw new Error('Project not found')
	}
	return project;
}

export async function deleteProject(projectId:string){
	console.log('deleting project', projectId)
	localForage.removeItem(`project_${projectId}`)
	const projects = await localForage.getItem('projects') as any [] || [];
	const index = projects.indexOf(projectId);
	if (index > -1) {
		projects.splice(index, 1);
	}
	await localForage.setItem('projects', projects);
	console.log('project deleted')
}

export function updateProject(project:any){
	console.log('updating project', project)
	//if the project is not in the database, store it
	if(project.id === undefined){
		console.log('project not in database. Adding it')
		storeProject(project);
		return;
	}
	localForage.setItem(`project_${project.id}`, project)
	console.log('project updated')
}

export async function getAllProjects() : Promise<{}[]> {
	console.log('getting all projects')
	const projects = await localForage.getItem('projects') as any[] || [];
	const allProjects = [];
	for(let i = 0; i < projects.length; i++){
		try {
			allProjects[i] = await getProject(projects[i]);
		}
		catch (error) {
			console.log('error', error)
			projects.splice(i, 1);
			i--;
		}
	}
	console.log('projects', allProjects)
	await localForage.setItem('projects', projects);
	return allProjects;
}

export async function login() {
	console.log('logging util')
	const currentUrl = new URL(window.location.href);
	const state = Math.random().toString(36).substring(7);
	await localForage.setItem('figmaState', state)
	const url = new URL(`https://www.figma.com/oauth?client_id=${import.meta.env.VITE_ID}&redirect_uri=${encodeURI(currentUrl.toString())}?callback&scope=file_read&state=${state}&response_type=code`)
	window.location.replace(url.toString())
}

export async function logout(router:any) {
	console.log('logout util')
	await localForage.removeItem('access_token')
	await localForage.removeItem('expires_in')
	await localForage.removeItem('refresh_token')
	await localForage.removeItem('figmaState')
	//remove all projects in storage
	const projects = await getAllProjects();
	projects.forEach((project:any) => {
		deleteProject(project.id);
	});
	//navigate to landingpage
	router.push({ name: 'landingpage' });
}