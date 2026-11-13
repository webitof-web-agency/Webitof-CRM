// Lists every API route with the permissions its requirePermission guards ask for.
//
// requirePermission is wrapped before any route file loads, so each guard it returns carries
// its permission list. The routers are then walked in mount order: a route is "public" when it
// is mounted before the global requireAuth and has no requireAuth of its own.
const authModule = require('../../middlewares/auth');

const original = authModule.requirePermission;
authModule.requirePermission = (...permissions) => {
  const guard = original(...permissions);
  guard.qaPermissions = permissions;
  return guard;
};

function mountPath(layer) {
  if (!layer.regexp || layer.regexp.fast_slash) return '';
  const source = layer.regexp.source
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/');
  return source;
}

function collect(stack, prefix, state, out) {
  let routerGuards = [...state.guards];
  let authed = state.authed;
  for (const layer of stack) {
    if (layer.route) {
      const handlers = layer.route.stack.map((s) => s.handle);
      const guards = handlers.filter((h) => h.qaPermissions).map((h) => h.qaPermissions);
      const ownAuth = handlers.some((h) => h === authModule.requireAuth);
      for (const method of Object.keys(layer.route.methods)) {
        out.push({
          method: method.toUpperCase(),
          path: `${prefix}${layer.route.path}`,
          public: !(authed || ownAuth),
          // Every guard in the chain must pass; each guard passes on ANY of its permissions.
          guards: [...routerGuards, ...guards]
        });
      }
    } else if (layer.handle && layer.handle.stack) {
      collect(layer.handle.stack, `${prefix}${mountPath(layer)}`, { guards: routerGuards, authed }, out);
    } else if (layer.handle === authModule.requireAuth) {
      authed = true;
    } else if (layer.handle && layer.handle.qaPermissions) {
      routerGuards = [...routerGuards, layer.handle.qaPermissions];
    }
  }
  return out;
}

function listRoutes() {
  const router = require('../../routes');
  return collect(router.stack, '', { guards: [], authed: false }, []);
}

// Would this user get past the route guards?
function guardAllows(route, user) {
  if (user.isSuperAdmin) return true;
  return route.guards.every((anyOf) => anyOf.length === 0 || anyOf.some((p) => user.permissions.includes(p)));
}

module.exports = { listRoutes, guardAllows };
