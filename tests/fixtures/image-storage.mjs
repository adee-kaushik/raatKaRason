const files=new Map();export async function putImage(id,body,contentType){files.set(id,{body,contentType});}export async function getImage(id){return files.get(id)||null;}
