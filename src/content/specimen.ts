// Landing-page specimen (docs/DESIGN.md §4.1).
//
// A hand-written sample Overview in the exact shape Codexplain's Overview mode
// produces (Summary / Key parts / How it fits in, with L-refs), for a real file
// from one of the example repositories. It is static so the landing page needs
// no model call. A maintainer can replace `overviewMarkdown` with a generated
// Overview of the same file version at any time.

export const specimen = {
  owner: "sindresorhus",
  repo: "got",
  ref: "main",
  path: "source/core/utils/get-body-size.ts",
  language: "typescript",
  generatedAt: "2026-10-13",
  overviewMarkdown: "## Summary\n\n`getBodySize` works out how many bytes a request body will send, so got can set or check `Content-Length` before the request goes out. It returns `undefined` when the size can't be known up front, such as for a stream.\n\n## Key parts\n\n- **Header first** (L6-L8): if the caller already set a `content-length` header, that value wins and is returned as a number. The body is never inspected.\n- **Empty body** (L10-L12): a missing body counts as `0` bytes.\n- **Strings** (L14-L16): strings are encoded to UTF-8 with `stringToUint8Array` and measured in bytes, not characters, so `\"\u00e9\"` counts as 2.\n- **Binary views** (L18): `Buffer`, typed arrays and `DataView` report `byteLength`. Anything else, such as a stream or form data, returns `undefined`.\n\n## How it fits in\n\nThe default export is a small helper in `source/core/utils/`. The request core likely calls it while preparing the outgoing request, and treats `undefined` as \"send with chunked encoding\". It depends only on `@sindresorhus/is` for the string check and `uint8array-extras` for encoding.",
  code: "import type {ClientRequestArgs} from 'node:http';\nimport is from '@sindresorhus/is';\nimport {stringToUint8Array} from 'uint8array-extras';\n\nexport default function getBodySize(body: unknown, headers: ClientRequestArgs['headers']): number | undefined {\n\tif (headers && 'content-length' in headers && headers['content-length'] !== undefined) {\n\t\treturn Number(headers['content-length']);\n\t}\n\n\tif (!body) {\n\t\treturn 0;\n\t}\n\n\tif (is.string(body)) {\n\t\treturn stringToUint8Array(body).byteLength;\n\t}\n\n\treturn ArrayBuffer.isView(body) ? body.byteLength : undefined;\n}\n",
} as const;
