import { ICommonObject, INode, INodeData, INodeParams } from '../../../src/Interface'

class Iteration_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    baseClasses: string[]
    documentation?: string
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = '迭代'
        this.name = 'iterationAgentflow'
        this.version = 1.0
        this.type = 'Iteration'
        this.category = 'Agent Flows'
        this.description = '通过N次迭代执行迭代块内的节点'
        this.baseClasses = [this.type]
        this.color = '#9C89B8'
        this.inputs = [
            {
                label: '数组输入',
                name: 'iterationInput',
                type: 'string',
                description: '要迭代的输入数组',
                acceptVariable: true,
                rows: 4
            }
        ]
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        const iterationInput = nodeData.inputs?.iterationInput

        // Helper function to clean JSON strings with redundant backslashes
        const safeParseJson = (str: string): string => {
            try {
                return JSON.parse(str)
            } catch {
                // Try parsing after cleaning
                return JSON.parse(str.replace(/\\(["'[\]{}])/g, '$1'))
            }
        }

        const iterationInputArray =
            typeof iterationInput === 'string' && iterationInput !== '' ? safeParseJson(iterationInput) : iterationInput

        if (!iterationInputArray || !Array.isArray(iterationInputArray)) {
            throw new Error('无效的输入数组')
        }

        const state = options.agentflowRuntime?.state as ICommonObject

        const returnOutput = {
            id: nodeData.id,
            name: this.name,
            input: {
                iterationInput: iterationInputArray
            },
            output: {},
            state
        }

        return returnOutput
    }
}

module.exports = { nodeClass: Iteration_Agentflow }
