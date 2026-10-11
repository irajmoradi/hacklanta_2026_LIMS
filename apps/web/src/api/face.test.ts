import { expect, test } from 'bun:test';
import { MockApi } from './mock';
import { DEMO_USER_ID } from './fixtures';
import { faceError, selfieError } from '../components/FaceCheck';
const sample = (name = 'match.jpg') => { const form = new FormData(); form.set('file', new File(['synthetic'], name, {type: 'image/jpeg'})); return form; };
test('face check outcomes, identity isolation, enrollment reset and shared rate limit', async () => {
  const api = new MockApi();
  expect(await api.request<any>('POST', '/auth/face-verify', DEMO_USER_ID, sample('no-face.jpg'))).toEqual({match:false,face_found:false});
  expect(await api.request<any>('POST', '/auth/face-verify', DEMO_USER_ID, sample('mismatch.jpg'))).toEqual({match:false,face_found:true});
  expect(await api.request<any>('POST', '/auth/face-verify', DEMO_USER_ID, sample())).toEqual({match:true,face_found:true});
  expect((await api.request<any>('GET','/me',DEMO_USER_ID)).user.face_verified_at).toBeTruthy();
  expect((await api.request<any>('GET','/me','00000000-0000-4000-8000-000000000002')).user.face_verified_at).toBeNull();
  await api.request<any>('POST', '/auth/face-enroll', DEMO_USER_ID);
  expect((await api.request<any>('GET','/me',DEMO_USER_ID)).user.face_verified_at).toBeNull();
  await expect(api.request<any>('POST', '/auth/face-verify', DEMO_USER_ID, sample('offline.jpg'))).rejects.toMatchObject({status:503});
  await expect(api.request<any>('POST', '/auth/face-enroll', DEMO_USER_ID)).rejects.toMatchObject({status:429});
});
test('selfies reject wrong types and oversized/empty data with friendly service errors', () => {
  expect(selfieError(new File(['x'],'x.txt',{type:'text/plain'}))).toContain('JPEG');
  expect(selfieError(new File([],'x.jpg',{type:'image/jpeg'}))).toContain('8 MiB');
  expect(selfieError(new File([new Uint8Array(8*1024*1024+1)],'x.jpg',{type:'image/jpeg'}))).toContain('8 MiB');
  expect(selfieError(new File(['x'],'x.png',{type:'image/png'}))).toBeNull();
  expect(faceError({status:429})).toContain('minute'); expect(faceError({status:503})).toContain('skip');
});
