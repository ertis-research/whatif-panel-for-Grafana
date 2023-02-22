import { SelectableValue } from '@grafana/data';
import { Checkbox, Field, HorizontalGroup, Icon, IconButton, Input, Select, useTheme2, CustomScrollbar } from '@grafana/ui';
import React, { useContext, useState, useEffect, ChangeEvent } from 'react';
import { Context, filesToSelect, groupBy, tagsToSelect } from '../utils/utils'
import { ICategory, IModel, ISelect, ITag, Interval, IFile, IData } from '../utils/types'
import { Steps } from 'utils/constants';
//import { Scrollbars } from 'react-custom-scrollbars-2'

interface Props {
    model ?: IModel,
    files ?: IFile[],
    deleteFile : any,
    updateFile : any
}

type IntervalColors = {
    DISABLED : Colors,
    UNREADY : Colors,
    READY : Colors   
}

type Colors = {
    bg: string,
    text: string
}

export const ModifyData: React.FC<Props> = ({ model, files, deleteFile, updateFile }) => {

    const theme = useTheme2()
    const context = useContext(Context)


    // UseState hook
    // -------------------------------------------------------------------------------------------------------------

    const [currentFile, setCurrentFile] = useState<SelectableValue<IFile>>()
    const [fileData, setfileData] = useState<IData[]>([])
    const [filesSelect, setfilesSelect] = useState<ISelect[]>([])

    const [searchValue, setSearchValue] = useState<SelectableValue<string>>()
    const [searchInputValue, setSearchInputValue] = useState<string>("")
    
    const [tags, setTags] = useState<ITag[]>([])
    const [filteredTags, setFilteredTags] = useState<ITag[]>([])
    const [tagsSearch, setTagsSearch] = useState<ISelect[]>([])
    
    const [interval, setInterval] = useState<Interval>({min: undefined, max: undefined, steps: undefined})
    const [hasInterval, setHasInterval] = useState<boolean>(false)


    // Auxiliar
    // -------------------------------------------------------------------------------------------------------------

    const disabled = (context.actualStep) ? context.actualStep  < Steps.step_3 : false
    const disabled_files = disabled || false

    

    const intervalColors:IntervalColors = {
        DISABLED : {
            bg: theme.colors.secondary.main,
            text: theme.colors.secondary.contrastText
        }, 
        UNREADY : {
            bg: theme.colors.error.main,
            text: theme.colors.error.contrastText
        },
        READY : {
            bg: theme.colors.success.main,
            text: theme.colors.success.contrastText
        }
    }

    const getColor = (attr:String) => {
        const key = attr as keyof Colors
        return (disabled) ? intervalColors.DISABLED[key] : (hasInterval) ? intervalColors.READY[key] : intervalColors.UNREADY[key]
    }

    const updateFilteredTags = () => {
        if (searchInputValue) {
            setFilteredTags(tags.filter(t => !searchInputValue 
                || t.id.toLowerCase().includes(searchInputValue.toLowerCase()) 
                || t.description && t.description.toLowerCase().includes(searchInputValue.toLowerCase())))
        } else {
            setFilteredTags(tags)
        }
    }


    // OnChange event
    // -------------------------------------------------------------------------------------------------------------

    const handleOnChangeInterval = (event:ChangeEvent<HTMLInputElement>) => {
        setInterval({
            ...interval,
            [event.currentTarget.name] : event.target.value
        })
    }

    const handleOnChangeTagValue = (event:ChangeEvent<HTMLInputElement>) => {
        const dataIndex = fileData.findIndex((d:IData) => d.id == event.currentTarget.name)
        if(dataIndex >= 0){
            const updatedFileData = [...fileData]
            updatedFileData[dataIndex].new_value = event.target.value
            setfileData(updatedFileData)
        }
    }

    const handleOnChangePercentage = (event:ChangeEvent<HTMLInputElement>) => {
        const dataIndex = fileData.findIndex((d:IData) => d.id == event.currentTarget.name)
        if(dataIndex >= 0){
            const updatedFileData = [...fileData]
            const old_value = updatedFileData[dataIndex].set_percentage
            updatedFileData[dataIndex].set_percentage = (!old_value) ? true : false
            setfileData(updatedFileData)
        }
    }

    const handleOnClickDeleteFile = () => {
        if(files && files.length == 1) context.setActualStep(Steps.step_2)
        if(currentFile && currentFile.value) deleteFile(currentFile.value.id)
        setCurrentFile(undefined)
    }


    // UseEffect hook
    // -------------------------------------------------------------------------------------------------------------

    useEffect(() => {
        console.log(model)
        if (model && model.tags) setTags(model.tags)
    }, [model])

    useEffect(() => {
        if(interval.max && interval.min && interval.steps) {
            setHasInterval(true)
        } else {
            setHasInterval(false)
        }
    }, [interval])

    useEffect(() => {
        setTagsSearch(tagsToSelect(tags))
        updateFilteredTags()
    }, [tags])

    useEffect(() => {
        updateFilteredTags()
    }, [searchInputValue])

    useEffect(() => {
        const options:ISelect[] = filesToSelect( (files != undefined) ? files : [])
        setfilesSelect(options)
        if(!currentFile && options.length > 0) setCurrentFile(options[0])
    }, [files])

    useEffect(() => {
        if(currentFile && currentFile.value){
            setfileData(currentFile.value.data)
        } else {
            setfileData([])
        }
    }, [currentFile])
    
    


    // HTML
    // -------------------------------------------------------------------------------------------------------------

    const tagField = (tag:ITag) => {
        const findRes = fileData.find((d) => d.id == tag.id)
        const data:IData = (findRes) ? findRes : { id: tag.id }
        return <div className='col-6 col-sm-6 col-lg-4 col-xl-3'>
            <p className='noSpaceBottom id wrap-hidden' style={{ color:theme.colors.text.secondary }}>{tag.id}</p>
            <p className="noSpaceBottom description wrap-hidden">{(tag.description) ? tag.description : <br/>}</p>
            <Field>
                <HorizontalGroup>
                    <Input width={8} value={data.default_value} disabled type='text'/>
                    <Input name={tag.id} value={data.new_value} disabled={disabled || (hasInterval && data.set_percentage)} type='number' onChange={handleOnChangeTagValue} />
                    <Checkbox name={tag.id} value={data.set_percentage} disabled={!hasInterval} onChange={handleOnChangePercentage} />
                </HorizontalGroup>
            </Field>
        </div>
    }

    const getListTags = () => {
        const categories:ICategory = groupBy(filteredTags, "category")
        return <div>
            {Object.entries(categories).map(([category, tagsCategory]) => {
                return <div style={{ marginRight: '15px', marginBottom: '20px'}}>
                    <p className='wrap category noSpaceBottom'>{category}</p>
                    <hr className='noSpaceTop'/>
                    <div className="row">
                        {tagsCategory.map((item:ITag) => tagField(item))}
                    </div>
                </div>
            })}
        </div>
    }

    return <div style={{ maxHeight:context.height }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '10px' }}>
            <Select
                    options={filesSelect}
                    value={currentFile}
                    onChange={(v) => setCurrentFile(v)}
                    prefix={<Icon name="file-alt"/>} 
                    disabled={disabled_files}
                    width={20}
                    defaultValue={filesSelect[0]}
            />
            <IconButton name='trash-alt' style={{ marginLeft: '5px'}} disabled={disabled} onClick={handleOnClickDeleteFile}/>
        </div>
        <div style={{backgroundColor:theme.colors.background.secondary, padding:'10px'}}>
            <div className='row'>
                <div className='col-12 col-sm-4'>
                    <p style={{color:theme.colors.text.secondary, paddingBottom:'0px', marginBottom: '2px'}}>Step 3</p>
                    <h4>Modify data</h4>
                </div>
                <div className='col-12 col-sm-8'>
                    <div className='horizontalDiv' style = {{ marginBottom: '15px', marginTop: '10px' }}>
                        <span style={{ marginRight: '10px', marginBottom:'3px', padding: '3px 5px', backgroundColor: getColor('bg'), color: getColor('text')}}>Intervalo</span>
                        <Field label="Min" className='textCenter noSpace' disabled={disabled}>
                            <Input name="min" width={6} className='noSpace' value={interval?.min} onChange={handleOnChangeInterval} type='number'   />
                        </Field>
                        <span style={{ marginRight: '10px' }}>%</span>
                        <Field label="Max" className='textCenter noSpace' disabled={disabled}>
                            <Input name="max" width={6} className='noSpace' value={interval?.max} onChange={handleOnChangeInterval} type='number' disabled={disabled} />
                        </Field>
                        <span style={{ marginRight: '10px' }}>%</span>
                        <Field label="Steps" className='textCenter noSpace' disabled={disabled}>
                            <Input name="steps" width={6} className='noSpace' value={interval?.steps} onChange={handleOnChangeInterval} type='number' disabled={disabled}/>
                        </Field>
                    </div>
                </div>
            </div>
            <Select
                options={tagsSearch}
                value={searchValue}
                inputValue={searchInputValue}
                onChange={(v) => setSearchValue(v)}
                prefix={<Icon name="search"/>} 
                placeholder="Search"
                disabled={disabled}
                isOpen={false}
                backspaceRemovesValue={false}
                onInputChange={(v, action) => {
                    if(action.action == 'set-value' || action.action == 'input-change'){
                        setSearchInputValue(v)
                    }
                }}
            />
            <div className='container' style={{ marginTop: '20px', width: '100%', height: context.height-190, minHeight:'380px'}}>
                <CustomScrollbar className='scroll'> 
                    {getListTags()}
                </CustomScrollbar>
            </div>
        </div>
    </div>
}

//style={{ width: '100%', height: context.height-190, minHeight:'380px' }}