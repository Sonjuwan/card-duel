package com.cardduel.solo;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

final class BackupPayload {
    static final int LIMIT=8*1024*1024;
    private BackupPayload(){}
    static boolean validRequest(String id,String operation,String filename,String json){
        if(id==null||!id.matches("[0-9-]{1,80}")||operation==null||filename==null||json==null)return false;
        if("open".equals(operation))return filename.isEmpty()&&json.isEmpty();
        if(!"save".equals(operation)||!filename.matches("card-duel-(decks|growth)-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json"))return false;
        return json.length()<=LIMIT&&json.getBytes(StandardCharsets.UTF_8).length<=LIMIT;
    }
    static String readUtf8(InputStream in,int limit)throws IOException{
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[16384];int length,total=0;
        while((length=in.read(buffer))!=-1){total+=length;if(total>limit)throw new IOException("File too large");bytes.write(buffer,0,length);}
        return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
    }
}
