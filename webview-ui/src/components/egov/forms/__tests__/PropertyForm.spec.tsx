import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "../../../../i18n"
import PropertyForm from "../PropertyForm"
import { ConfigGenerationType, TemplateConfig } from "../../types/templates"
import { vscode } from "../../../../utils/vscode"

vi.mock("../../../../utils/vscode", () => ({ vscode: { postMessage: vi.fn() } }))

const template: TemplateConfig = {
	displayName: "Property > New Property",
	templateFolder: "property",
	templateFile: "property.hbs",
	webView: "property-form.tsx",
	fileNameProperty: "txtFileName",
	javaConfigTemplate: "property-java.hbs",
	yamlTemplate: "",
	propertiesTemplate: "",
	description: "Property service",
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Generate" }))
const selectFolder = () =>
	act(() => {
		window.dispatchEvent(new MessageEvent("message", { data: { type: "selectedOutputFolder", text: "/example/output" } }))
	})

beforeEach(() => vi.clearAllMocks())

describe.each([ConfigGenerationType.XML, ConfigGenerationType.JAVA_CONFIG])("PropertyForm %s", (generationType) => {
	const renderForm = () => {
		const onSubmit = vi.fn()
		render(
			<PropertyForm
				template={template}
				onSubmit={onSubmit}
				onCancel={vi.fn()}
				initialData={{
					generationType,
					txtFileName: generationType === ConfigGenerationType.XML ? "context-properties" : "EgovPropertiesConfig",
				}}
			/>,
		)
		return onSubmit
	}

	it.each(["hello", "10", ""])("passes the string Value %j through folder selection", (value) => {
		const onSubmit = renderForm()
		fireEvent.change(screen.getByRole("textbox", { name: "Key" }), { target: { value: "greeting" } })
		fireEvent.change(screen.getByRole("textbox", { name: "Value" }), { target: { value } })
		submit()
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "selectOutputFolder",
			formData: expect.objectContaining({
				generationType,
				rdoType: "Internal Properties",
				txtKey: "greeting",
				txtValue: value,
			}),
		})
		expect(onSubmit).not.toHaveBeenCalled()
		selectFolder()
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ generationType, txtKey: "greeting", txtValue: value, outputFolder: "/example/output" }),
		)
	})

	it("submits External File after a string Value was entered in Internal Properties", () => {
		const onSubmit = renderForm()
		fireEvent.change(screen.getByRole("textbox", { name: "Value" }), { target: { value: "hello" } })
		fireEvent.click(screen.getByRole("radio", { name: "External File" }))
		expect(screen.queryByRole("textbox", { name: "Value" })).not.toBeInTheDocument()
		fireEvent.change(screen.getByRole("textbox", { name: /Property File Name/ }), {
			target: { value: "classpath:/example.properties" },
		})
		submit()
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "selectOutputFolder",
			formData: expect.objectContaining({
				generationType,
				rdoType: "External File",
				txtPropertyFile: "classpath:/example.properties",
			}),
		})
		selectFolder()
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				generationType,
				rdoType: "External File",
				txtPropertyFile: "classpath:/example.properties",
				outputFolder: "/example/output",
			}),
		)
	})

	it("still rejects a missing external filename even with a hidden string Value", () => {
		const onSubmit = renderForm()
		fireEvent.change(screen.getByRole("textbox", { name: "Value" }), { target: { value: "hello" } })
		fireEvent.click(screen.getByRole("radio", { name: "External File" }))
		fireEvent.change(screen.getByRole("textbox", { name: /Property File Name/ }), { target: { value: "" } })
		submit()
		expect(screen.getByText(/Please fill in the following required fields: Property File Name/)).toBeInTheDocument()
		expect(vscode.postMessage).not.toHaveBeenCalled()
		expect(onSubmit).not.toHaveBeenCalled()
	})
})
