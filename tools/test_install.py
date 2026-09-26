"""Local fake-HA smoke test; never contacts a real Home Assistant instance."""
import contextlib
import io
import unittest

from aiohttp import web
import install


class InstallerTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.scripts = {}
        self.dashboards = []
        self.resources = []
        self.dashboard_config = None
        app = web.Application()
        app.router.add_route('*', '/{path:.*}', self.handler)
        self.runner = web.AppRunner(app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, '127.0.0.1', 0)
        await self.site.start()
        self.url = 'http://127.0.0.1:' + str(self.site._server.sockets[0].getsockname()[1])

    async def asyncTearDown(self):
        await self.runner.cleanup()

    async def handler(self, request):
        path = request.path
        if path == '/api/websocket':
            ws = web.WebSocketResponse()
            await ws.prepare(request)
            await ws.send_json({'type': 'auth_required'})
            auth = await ws.receive_json()
            self.assertEqual(auth['access_token'], 'fake-test-token')
            await ws.send_json({'type': 'auth_ok'})
            async for message in ws:
                if message.type != web.WSMsgType.TEXT:
                    continue
                data = message.json()
                kind = data['type']
                if kind == 'lovelace/resources': result = self.resources
                elif kind == 'lovelace/dashboards/list': result = self.dashboards
                elif kind == 'lovelace/resources/create':
                    result = {'id': 'test-resource', 'url': data['url']}
                    self.resources.append(result)
                elif kind == 'lovelace/resources/update':
                    self.resources[0]['url'] = data['url']; result = self.resources[0]
                elif kind == 'lovelace/dashboards/create':
                    result = {'url_path': data['url_path']}; self.dashboards.append(result)
                elif kind == 'lovelace/config/save':
                    self.dashboard_config = data['config']; result = None
                else: raise AssertionError(kind)
                await ws.send_json({'id': data['id'], 'success': True, 'result': result})
            return ws
        if path == '/local/nfc/nfc-card-enroller.js':
            return web.Response(body=(install.ROOT / 'home_assistant/nfc_spotify/nfc-card-enroller.js').read_bytes())
        if path.startswith('/api/config/script/config/'):
            key = path.rsplit('/', 1)[1]
            if request.method == 'POST':
                self.scripts[key] = await request.json(); return web.json_response({'result': 'ok'})
            if key not in self.scripts: raise web.HTTPNotFound()
            return web.json_response(self.scripts[key])
        if path == '/api/config/core/check_config': return web.json_response({'result': 'valid'})
        if path.startswith('/api/services/'): return web.json_response([])
        if path.startswith('/api/states/'): return web.json_response({'state': 'ready'})
        raise web.HTTPNotFound()

    async def test_install_and_repeat_preserve_user_data(self):
        with contextlib.redirect_stdout(io.StringIO()):
            await install.install(self.url, 'fake-test-token')
            self.assertEqual(len(self.scripts), 4)
            self.assertEqual(self.dashboards[0]['url_path'], 'nfc-cards')
            self.assertEqual(self.dashboard_config['title'], 'NFC Cards')
            self.assertEqual(self.dashboard_config['views'][0]['path'], 'enroll')
            self.assertEqual(self.scripts['nfc_jukebox_play_card']['variables']['card_map'], {})
            self.assertEqual(self.scripts['nfc_jukebox_reader_config']['variables']['profiles'], {})
            self.scripts['nfc_jukebox_play_card']['variables']['card_map']['USER'] = {'name': 'Keep this'}
            self.dashboard_config['title'] = 'User title'
            await install.install(self.url, 'fake-test-token')
        self.assertEqual(len(self.resources), 1)
        self.assertEqual(len(self.dashboards), 1)
        self.assertEqual(self.dashboard_config['title'], 'User title')
        self.assertEqual(self.scripts['nfc_jukebox_play_card']['variables']['card_map']['USER']['name'], 'Keep this')


if __name__ == '__main__':
    unittest.main()
