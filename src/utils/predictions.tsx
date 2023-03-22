import { PreprocessCodeDefault } from "./default";
import { IData, IDataCollection, IFormat, IInterval, IModel, IResult } from "./types"
import * as dfd from "danfojs"
import { variableInput, variableOutput } from "./constants";

export const predictAllCollections = async (model:IModel, allData:IDataCollection[]) => {
    for(const [i, d] of allData.entries()){
        allData[i] =  {...d, results: await predictData(model, d)}
    }
    return allData
}

const predictData = async (model:IModel, dataCollection:IDataCollection) => {
    let results:IResult[] = prepareData(dataCollection)
    let dataToPredict:number[][] = []
    console.log('results', results)
    for(const [i, r] of results.entries()){
        let finalData = r.data
        if(model.scaler){
            //finalData = await applyScaler(model.scaler, finalData)
        }
        if(model.preprocess){
            //finalData = await applyPreprocess(model.preprocess, finalData)
            //console.log("preprocess", finalData)
        }
        dataToPredict.push(finalData)
        results[i] = { ...r, processedData : finalData }
    }
    const predictions:number[] = await sendRequest(model.url, model.method, dataToPredict, model.format)
    return results.map<IResult>((r:IResult, indx:number) => { return {...r, result: predictions[indx]}})
}

const getPercentagesFromInterval = (interval:IInterval) : number[] => {
    if(interval.max == undefined || interval.min == undefined || interval.steps == undefined) return []

    const min_interval:number = Number(interval.min), max_interval:number = Number(interval.max), step_interval:number = Number(interval.steps)

    const porcentages_min:number[] = Array.from({ length: Math.ceil(min_interval / step_interval)}, (_, i:number) => { var num = 0 - ((i+1) * step_interval); return (num < -min_interval) ? -min_interval : num})
    const porcentages_max:number[] = Array.from({ length: Math.ceil(max_interval / step_interval)}, (_, i:number) => { var num = (i+1) * step_interval; return (num > max_interval) ? max_interval : num})

    return porcentages_min.concat(porcentages_max).sort((a,b)=>a-b)
}

const calculatePercentage = (percent:number, total:number) => {
    return (percent / 100) * total
 } 

const addResultsFromPorcentage = (res:IResult[], defaultData:number[], porcentages:number[], indx:number, id:string) => {
    const defData:number = defaultData[indx]

    porcentages.forEach((p:number) => {
        const v = calculatePercentage(Math.abs(p), defData)
        let newData = [...defaultData]
        newData[indx] = (p < 0) ? defData - v : defData + v
        res.push({
            id : id + "_" + ((p < 0) ? 'less' : 'plus') + Math.abs(p),
            data : newData
        })
    })

    return res
}

const prepareData = (dataCollection:IDataCollection) : IResult[] => {
    let res:IResult[] = []
    
    // Prediccion basica con los valores nuevos
    const defaultData:number[] = dataCollection.data.map((d:IData) => (d.set_percentage == true || d.new_value == undefined) ? ((d.default_value) ? d.default_value : 0) : Number(d.new_value))
    res.push({
        id : 'basic_newValue',
        data : defaultData
    })

    // Predicciones cambiando el intervalo
    const interval:IInterval = dataCollection.interval
    if(interval.max != undefined && interval.min != undefined && interval.steps != undefined) {
        const porcentages:number[] = getPercentagesFromInterval(interval)
        console.log('porcentages', porcentages)
        dataCollection.data.filter((sData:IData) => sData.set_percentage).forEach((sData:IData) => {
            const indx:number = dataCollection.data.findIndex((iData:IData) => iData.id == sData.id)
            res = addResultsFromPorcentage(res, defaultData, porcentages, indx, sData.id)
        })
    }

    return res
}

export const applyScaler = async (scaler:File, data:number[]) => {
    let sf = new dfd.Series([100,1000,2000, 3000])
    let standardScaler = new dfd.StandardScaler()
    standardScaler.fit(sf)
    return standardScaler.transform(sf)
}

export const applyPreprocess = async (code:string, data:number[]) => {
    if(code != PreprocessCodeDefault){
        const dataUri = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(code);
        const module = await import(dataUri);
        console.log(module); // property default contains function hello now
        const preprocess = module.default;
        try {
            data = preprocess(data)
        } catch (error) {
            console.error("Preprocess failed")
        }
    }
    return data
}

const addFormatInput = (data:number[]|number[][], format?:IFormat) : string => {
    let body = JSON.stringify(data)
    if (data.length > 0 && Array.isArray(data[0])) body = body.substring(1,body.length-1)
    if (format != undefined) body = format.input.replace(variableInput, body)
    return body
}

const removeFormatOutput = (result:string, format?:IFormat) : number[] => {
    if(format != undefined) {
        const indx = format.output.indexOf(variableOutput)
        
        const res:string[] = result
                            .replace(format.output.slice(0, indx), "")
                            .replace(format.output.slice(indx+variableOutput.length+1, format.output.length), "")
                            .split(',')
        const resNum:number[] = res.map((r:string) => Number(r.replace(/[^\d.-]/g, '')))
        return resNum
    }
    return [Number(result)]
}

const sendRequest = async (url:string, method:string, data:number[]|number[][], format?:IFormat) => {
    let myHeaders = new Headers()
    myHeaders.append("Content-Type", "application/json")

    let body = addFormatInput(data, format)

    let requestOptions:RequestInit = {
        method: method,
        headers: myHeaders,
        body: body
    }

    let response = await fetch(url, requestOptions)
    let text:string = await response.text()
    return removeFormatOutput(text, format)
}