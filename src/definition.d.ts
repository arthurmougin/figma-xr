import { GetFileResponse } from '@figma/rest-api-spec';

export enum logStateOptions {
    'not logged in',
    'logging in',
    'logged in',
    'error'
}

export type ProjectData = GetFileResponse & {
    id:string
}

export type FrameImage = {id:string,nodeType:string,image?:string}
export type ProjectList = string[]