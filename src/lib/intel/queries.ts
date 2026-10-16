/**
 * Tree-sitter queries per grammar. Captures:
 *   @import             a module specifier (quotes are stripped later)
 *   @name + @def.<kind> a definition and the node spanning its body
 */

const JS_COMMON = `
(import_statement source: (string (string_fragment) @import))
(export_statement source: (string (string_fragment) @import))
(call_expression function: (identifier) @_req arguments: (arguments . (string (string_fragment) @import)) (#eq? @_req "require"))
(call_expression function: (import) arguments: (arguments . (string (string_fragment) @import)))
(function_declaration name: (identifier) @name) @def.function
(generator_function_declaration name: (identifier) @name) @def.function
(class_declaration name: (_) @name) @def.class
(method_definition name: (property_identifier) @name) @def.method
(lexical_declaration (variable_declarator name: (identifier) @name value: [(arrow_function) (function_expression)])) @def.function
(variable_declaration (variable_declarator name: (identifier) @name value: [(arrow_function) (function_expression)])) @def.function
`;

const TS_EXTRA = `
(interface_declaration name: (type_identifier) @name) @def.interface
(type_alias_declaration name: (type_identifier) @name) @def.type
(enum_declaration name: (identifier) @name) @def.enum
(abstract_class_declaration name: (type_identifier) @name) @def.class
`;

export const QUERIES: Record<string, string> = {
  javascript: JS_COMMON,
  typescript: JS_COMMON + TS_EXTRA,
  tsx: JS_COMMON + TS_EXTRA,
  python: `
(import_statement name: (dotted_name) @import)
(import_statement name: (aliased_import name: (dotted_name) @import))
(import_from_statement module_name: (_) @import)
(function_definition name: (identifier) @name) @def.function
(class_definition name: (identifier) @name) @def.class
`,
  go: `
(import_spec path: (interpreted_string_literal) @import)
(function_declaration name: (identifier) @name) @def.function
(method_declaration name: (field_identifier) @name) @def.method
(type_spec name: (type_identifier) @name) @def.type
`,
  rust: `
(use_declaration argument: (_) @import)
(mod_item name: (identifier) @import !body)
(function_item name: (identifier) @name) @def.function
(struct_item name: (type_identifier) @name) @def.struct
(enum_item name: (type_identifier) @name) @def.enum
(trait_item name: (type_identifier) @name) @def.trait
`,
  java: `
(import_declaration (scoped_identifier) @import)
(class_declaration name: (identifier) @name) @def.class
(interface_declaration name: (identifier) @name) @def.interface
(enum_declaration name: (identifier) @name) @def.enum
(method_declaration name: (identifier) @name) @def.method
`,
  ruby: `
(call method: (identifier) @_m arguments: (argument_list . (string (string_content) @import)) (#match? @_m "^require(_relative)?$"))
(method name: (_) @name) @def.method
(class name: (_) @name) @def.class
(module name: (_) @name) @def.module
`,
  php: `
(function_definition name: (name) @name) @def.function
(class_declaration name: (name) @name) @def.class
(method_declaration name: (name) @name) @def.method
(interface_declaration name: (name) @name) @def.interface
`,
  "c-sharp": `
(class_declaration name: (identifier) @name) @def.class
(interface_declaration name: (identifier) @name) @def.interface
(method_declaration name: (identifier) @name) @def.method
(enum_declaration name: (identifier) @name) @def.enum
`,
};
