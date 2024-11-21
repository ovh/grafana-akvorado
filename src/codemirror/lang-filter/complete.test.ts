import {EditorState} from '@codemirror/state';
import {CompletionContext, autocompletion, type CompletionResult} from '@codemirror/autocomplete';
import {filterLanguage, filterCompletion} from '.';
import {FetchResponse} from '@grafana/runtime';
import {ApiCompleteResult} from '../../types';


export interface Body {
    what: 'column' | 'operator' | 'value';
    column?: string;
    prefix?: string;
}

describe('filter completion', () => {
    let requestBody: Body | undefined = undefined;
    let mockPost: (url: string, body?: {}, params?: string) => Promise<FetchResponse<ApiCompleteResult>>;

    // Use the mocked DataSource class directly
    const DataSource = require('../../datasource').DataSource;
    const dataSource = new DataSource(); // No need to pass instanceSettings

    async function get(doc: string): Promise<CompletionResult> {
        const cur: number = doc.indexOf('|');
        doc = doc.slice(0, cur) + doc.slice(cur + 1);
        const state = EditorState.create({
            doc,
            selection: {anchor: cur},
            extensions: [filterLanguage(), filterCompletion(dataSource), autocompletion()],
        });
        return await state.languageDataAt<any>('autocomplete', cur)[0](new CompletionContext(state, cur, true));
    }

    function mockedResults(body: Body): ApiCompleteResult {
        switch (body.what) {
            case 'column':
                return {
                    completions: [
                        {label: 'SrcAS', detail: 'column name', quoted: false},
                        {label: 'SrcAddr', detail: 'column name', quoted: false},
                        {
                            label: 'SrcCountry',
                            detail: 'column name',
                            quoted: false,
                        },
                        {label: 'DstAS', detail: 'column name', quoted: false},
                        {label: 'DstAddr', detail: 'column name', quoted: false},
                        {
                            label: 'DstCountry',
                            detail: 'column name',
                            quoted: false,
                        },
                    ].filter(({label}) => label.startsWith(body.prefix ?? '')),
                };
            case 'operator':
                switch (body.column) {
                    case 'SrcAS':
                        return {
                            completions: [
                                {label: '=', detail: 'operator', quoted: false},
                                {label: '!=', detail: 'operator', quoted: false},
                                {label: 'IN', detail: 'operator', quoted: false},
                            ].filter(({label}) => label.startsWith(body.prefix ?? '')),
                        };
                    default:
                        throw new Error(`unhandled column name: ${body.column}`);
                }
            case 'value':
                switch (body.column) {
                    case 'DstNetName':
                        return {
                            completions: [
                                {
                                    label: 'something',
                                    detail: 'network name',
                                    quoted: true,
                                },
                                {
                                    label: 'squid',
                                    detail: 'network name',
                                    quoted: true,
                                },
                            ].filter(({label}) => label.startsWith(body.prefix ?? '')),
                        };

                    case 'SrcAS':
                        return {
                            completions: [
                                {
                                    label: 'AS65403',
                                    detail: 'AS number',
                                    quoted: false,
                                },
                                {
                                    label: 'AS65404',
                                    detail: 'AS number',
                                    quoted: false,
                                },
                                {
                                    label: 'AS65405',
                                    detail: 'AS number',
                                    quoted: false,
                                },
                            ],
                        };
                    default:
                        throw new Error(`unhandled column name: ${body.column}`);
                }
            default:
                throw new Error(`unhandled what: ${body.what}`);
        }
    }


    jest.mock('../../datasource', () => {

        mockPost = jest.fn().mockImplementation((url: string, b: string) => {
            const body: Body = JSON.parse(b);
            requestBody = body;
            const data = mockedResults(body);
            const mockResponse = {
                ok: true,
                data: data,
            };
            return Promise.resolve(mockResponse as unknown as Response);
        });

        return {
            DataSource: jest.fn().mockImplementation(() => {
                return {
                    post: mockPost,
                };
            }),
        };
    });


    afterEach(() => {
        jest.restoreAllMocks();
        requestBody = undefined;
    });


    it('completes column names', async () => {
        const {from, to, options} = await get('S|');
        expect(requestBody).toEqual({
            what: 'column',
            prefix: 'S',
        });
        expect({from, to, options}).toEqual({
            from: 0,
            to: 1,
            options: [
                {apply: 'SrcAS ', detail: 'column name', label: 'SrcAS'},
                {apply: 'SrcAddr ', detail: 'column name', label: 'SrcAddr'},
                {apply: 'SrcCountry ', detail: 'column name', label: 'SrcCountry'},
            ],
        });
    });

    it('completes inside column names', async () => {
        const {from, to, options} = await get('S|rc =');
        expect(requestBody).toEqual({
            what: 'column',
            prefix: 'Src',
        });
        expect({from, to, options}).toEqual({
            from: 0,
            to: 3,
            options: [
                {apply: 'SrcAS ', detail: 'column name', label: 'SrcAS'},
                {apply: 'SrcAddr ', detail: 'column name', label: 'SrcAddr'},
                {apply: 'SrcCountry ', detail: 'column name', label: 'SrcCountry'},
            ],
        });
    });

    it('completes operator names', async () => {
        const {from, to, options} = await get('SrcAS |');
        expect(requestBody).toEqual({
            what: 'operator',
            column: 'SrcAS',
        });
        expect({from, to, options}).toEqual({
            from: 6,
            to: 6,
            options: [
                {apply: '= ', detail: 'operator', label: '='},
                {apply: '!= ', detail: 'operator', label: '!='},
                {apply: 'IN ', detail: 'operator', label: 'IN'},
            ],
        });
    });

    it('completes values', async () => {
        const {from, to, options} = await get('SrcAS = fac|');
        expect(requestBody).toEqual({
            what: 'value',
            column: 'SrcAS',
            prefix: 'fac',
        });
        expect({from, to, options}).toEqual({
            from: 8,
            to: 11,
            options: [
                {apply: 'AS65403 ', detail: 'AS number', label: 'AS65403'},
                {apply: 'AS65404 ', detail: 'AS number', label: 'AS65404'},
                {apply: 'AS65405 ', detail: 'AS number', label: 'AS65405'},
            ],
        });
    });

    it('completes quoted values', async () => {
        const {from, to, options} = await get('DstNetName = "so|');
        expect(requestBody).toEqual({
            what: 'value',
            column: 'DstNetName',
            prefix: 'so',
        });
        expect({from, to, options}).toEqual({
            from: 13,
            to: 16,
            options: [{apply: '"something" ', detail: 'network name', label: '"something"'}],
        });
    });

    it('completes quoted values even when not quoted', async () => {
        const {from, to, options} = await get('DstNetName = so|');
        expect(requestBody).toEqual({
            what: 'value',
            column: 'DstNetName',
            prefix: 'so',
        });
        expect({from, to, options}).toEqual({
            from: 13,
            to: 15,
            options: [{apply: '"something" ', detail: 'network name', label: '"something"'}],
        });
    });

    it('completes logic operator', async () => {
        const {from, to, options} = await get('SrcAS = 1000 A|');
        expect(requestBody).toEqual(undefined);
        expect({from, to, options}).toEqual({
            from: 13,
            to: 14,
            options: [
                {apply: 'AND ', detail: 'logic operator', label: 'AND'},
                {apply: 'OR ', detail: 'logic operator', label: 'OR'},
                {apply: 'AND NOT ', detail: 'logic operator', label: 'AND NOT'},
                {apply: 'OR NOT ', detail: 'logic operator', label: 'OR NOT'},
            ],
        });
    });

    it('does not complete comments', async () => {
        const {from, to, options} = await get('SrcAS = 1000 -- h|');
        expect(requestBody).toEqual(undefined);
        expect({from, to, options}).toEqual({
            from: 17,
            to: undefined,
            options: [],
        });
    });

    it('completes inside operator', async () => {
        const {from, to, options} = await get('SrcAS I|');
        expect(requestBody).toEqual({
            what: 'operator',
            prefix: 'I',
            column: 'SrcAS',
        });
        expect({from, to, options}).toEqual({
            from: 6,
            to: 7,
            options: [{apply: 'IN ', detail: 'operator', label: 'IN'}],
        });
    });

    it('completes empty list of values', async () => {
        const {from, to, options} = await get('SrcAS IN (|');
        expect(requestBody).toEqual({
            what: 'value',
            column: 'SrcAS',
        });
        expect({from, to, options}).toEqual({
            from: 10,
            options: [
                {apply: 'AS65403, ', detail: 'AS number', label: 'AS65403'},
                {apply: 'AS65404, ', detail: 'AS number', label: 'AS65404'},
                {apply: 'AS65405, ', detail: 'AS number', label: 'AS65405'},
            ],
        });
    });

    it('completes non-empty list of values', async () => {
        const {from, to, options} = await get('SrcAS IN (100,|');
        expect(requestBody).toEqual({
            what: 'value',
            column: 'SrcAS',
        });
        expect({from, to, options}).toEqual({
            from: 14,
            options: [
                {apply: ' AS65403, ', detail: 'AS number', label: 'AS65403'},
                {apply: ' AS65404, ', detail: 'AS number', label: 'AS65404'},
                {apply: ' AS65405, ', detail: 'AS number', label: 'AS65405'},
            ],
        });
    });

    it('completes NOT', async () => {
        const {from, to, options} = await get('SrcAS = 100 AND |');
        expect(requestBody).toEqual({
            what: 'column',
        });
        expect({from, to, options}).toEqual({
            from: 16,
            to: 16,
            options: [
                {apply: 'NOT ', detail: 'logic operator', label: 'NOT'},
                {apply: 'SrcAS ', detail: 'column name', label: 'SrcAS'},
                {apply: 'SrcAddr ', detail: 'column name', label: 'SrcAddr'},
                {apply: 'SrcCountry ', detail: 'column name', label: 'SrcCountry'},
                {apply: 'DstAS ', detail: 'column name', label: 'DstAS'},
                {apply: 'DstAddr ', detail: 'column name', label: 'DstAddr'},
                {apply: 'DstCountry ', detail: 'column name', label: 'DstCountry'},
            ],
        });
    });

    it('completes column after logic operator', async () => {
        const {from, to, options} = await get('SrcAS = 100 AND S|');
        expect(requestBody).toEqual({
            what: 'column',
            prefix: 'S',
        });
        expect({from, to, options}).toEqual({
            from: 16,
            to: 17,
            options: [
                {apply: 'SrcAS ', detail: 'column name', label: 'SrcAS'},
                {apply: 'SrcAddr ', detail: 'column name', label: 'SrcAddr'},
                {apply: 'SrcCountry ', detail: 'column name', label: 'SrcCountry'},
            ],
        });
    });
});
