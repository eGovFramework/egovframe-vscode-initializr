import { extractCreateTableStatements } from "./ddlParser"

export interface ErdColumn {
	name: string
	dataType: string
	isPrimaryKey: boolean
	isForeignKey: boolean
}

export interface ErdTable {
	name: string
	columns: ErdColumn[]
}

export interface ErdRelationship {
	fromTable: string
	fromColumn: string
	toTable: string
	toColumn: string
}

export interface ErdModel {
	tables: ErdTable[]
	relationships: ErdRelationship[]
}

function cleanIdentifier(identifier: string): string {
	return identifier.trim().replace(/^[`"']|[`"']$/g, "")
}

function splitColumnDefinitions(body: string): string[] {
	return body
		.split(/,(?![^(]*\))/)
		.map((definition) => definition.trim())
		.filter(Boolean)
}

function parseColumnList(columnList: string): string[] {
	return columnList.split(",").map(cleanIdentifier).filter(Boolean)
}

function getDefinitionKind(definition: string): string {
	return definition.split(/\s+/)[0]?.toUpperCase() || ""
}

// 제약조건 판정에 쓰지 않을 COMMENT 문자열 본문을 걷어낸다.
// 주석에 든 'primary key'·'references' 문구를 제약조건으로 오인하지 않기 위한 것으로,
// ddlParser의 PK 판정과 같은 규칙을 쓴다.
function stripColumnComment(definition: string): string {
	return definition.replace(/COMMENT\s+'(?:''|[^'])*'/i, "")
}

export function parseErdModel(ddl: string): ErdModel {
	const createTableStatements = extractCreateTableStatements(ddl)
	const tables: ErdTable[] = []
	const relationships: ErdRelationship[] = []

	for (const createTableStatement of createTableStatements) {
		const tableName = cleanIdentifier(createTableStatement.tableName)
		const definitions = splitColumnDefinitions(createTableStatement.body)
		const primaryKeyColumns = new Set<string>()
		const foreignKeyColumns = new Set<string>()
		const columns: ErdColumn[] = []

		for (const definition of definitions) {
			const definitionWithoutComment = stripColumnComment(definition)
			const pkMatch = /PRIMARY\s+KEY\s*\(([^)]+)\)/i.exec(definitionWithoutComment)
			if (pkMatch) {
				parseColumnList(pkMatch[1]).forEach((columnName) => primaryKeyColumns.add(columnName))
				continue
			}

			const fkMatch = /FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/i.exec(
				definitionWithoutComment,
			)
			if (fkMatch) {
				const fromColumns = parseColumnList(fkMatch[1])
				const toTable = cleanIdentifier(fkMatch[2])
				const toColumns = parseColumnList(fkMatch[3])

				fromColumns.forEach((fromColumn, index) => {
					foreignKeyColumns.add(fromColumn)
					relationships.push({
						fromTable: tableName,
						fromColumn,
						toTable,
						toColumn: toColumns[index] || toColumns[0] || "id",
					})
				})
				continue
			}
		}

		for (const definition of definitions) {
			const definitionKind = getDefinitionKind(definition)
			if (["PRIMARY", "FOREIGN", "CONSTRAINT", "UNIQUE", "KEY", "INDEX", "COMMENT"].includes(definitionKind)) {
				continue
			}

			const parts = definition.split(/\s+/).filter(Boolean)
			const columnName = cleanIdentifier(parts[0] || "")
			const dataType = (parts[1] || "").toUpperCase()

			if (!columnName || !dataType) {
				continue
			}

			const definitionWithoutComment = stripColumnComment(definition)
			const inlineReferenceMatch = /REFERENCES\s+[`"]?(\w+)[`"]?\s*\(([^)]+)\)/i.exec(definitionWithoutComment)
			if (inlineReferenceMatch) {
				const toTable = cleanIdentifier(inlineReferenceMatch[1])
				const toColumn = parseColumnList(inlineReferenceMatch[2])[0] || "id"
				foreignKeyColumns.add(columnName)
				relationships.push({
					fromTable: tableName,
					fromColumn: columnName,
					toTable,
					toColumn,
				})
			}

			columns.push({
				name: columnName,
				dataType,
				isPrimaryKey: primaryKeyColumns.has(columnName) || /\bPRIMARY\s+KEY\b/i.test(definitionWithoutComment),
				isForeignKey: foreignKeyColumns.has(columnName),
			})
		}

		if (columns.length > 0) {
			tables.push({ name: tableName, columns })
		}
	}

	return { tables, relationships }
}
