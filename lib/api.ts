export interface API {
    [func: string]: NativeFunction,
}

let cachedApi: API = null;
let cachedPrivateAPI: API = null;

export function getApi(): API {
    if (cachedApi !== null) {
        return cachedApi;
    }

    const pending = [
        {
            module: "libswiftCore.dylib",
            functions: {
                "swift_demangle": ["pointer", ["pointer", "size_t",
                    "pointer", "pointer", "int32"]],
                /* This one uses swiftcall actually but we we're lucky the
                 * registers are the same as SystemV for this particular case.
                 */
                "swift_stdlib_getTypeByMangledNameUntrusted": ["pointer",
                    ["pointer", "size_t"]],
            }
        }
    ];

    cachedApi = makeAPI(pending);
    return cachedApi;
}

export function getPrivateAPI(): API {
    if (cachedPrivateAPI !== null) {
        return cachedPrivateAPI;
    }

    const pending = [
        {
            module: "libmacho.dylib",
            functions: {
                "getsectiondata": ["pointer", ["pointer", "pointer",
                    "pointer", "pointer"]]
            }
        }
    ];

    cachedPrivateAPI = makeAPI(pending);
    return cachedPrivateAPI;
}

function makeAPI(exports: any): API {
    const result: API = {};

    exports.forEach(api => {
        const functions = api.functions || {};
        const module = Process.getModuleByName(api.module);

        Object.keys(functions).forEach(name => {
            Module.ensureInitialized(module.name);

            const exp = module.findExportByName(name) ||
                      DebugSymbol.fromName(name).address;

            if (exp.isNull()) {
                throw new Error(`Unable to find API: ${name}`);
            }

            const returnType = functions[name][0];
            const argumentTypes = functions[name][1];
            const native = new NativeFunction(exp, returnType, argumentTypes);

            result[name] = native;
        });
    });

    return result;
}